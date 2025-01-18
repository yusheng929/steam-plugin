import { App, Render } from '#components'
import { api, utils } from '#models'

const appInfo = {
  id: 'client',
  name: '客户端操作'
}

const baseReg = '(?:客户端|clinet|c)'

const rule = {
  info: {
    reg: App.getReg(`${baseReg}信息`),
    cfg: {
      tips: true
    },
    fnc: async e => {
      const token = await utils.steam.getAccessToken(e.user_id)
      if (!token.success) {
        await e.reply([segment.at(e.user_id), '\n', token.message])
        return true
      }
      const clients = await api.IClientCommService.GetAllClientLogonInfo(token.accessToken)
      if (!clients.sessions) {
        await e.reply([segment.at(e.user_id), '\n', '没有登录Steam客户端'])
        return true
      }
      const text = clients.sessions.map(i => [
        `instanceid: ${i.client_instanceid}`,
        `os: ${i.os_name}`,
        `name: ${i.machine_name}`
      ].join('\n')).join('\n----------\n')
      await e.reply([segment.at(e.user_id), '\n可用instanceid指定客户端默认为第一个\n', text])
      return true
    }
  },
  appList: {
    reg: App.getReg(`${baseReg}游戏列表(\\d*)`),
    cfg: {
      tips: true
    },
    fnc: async e => {
      const token = await utils.steam.getAccessToken(e.user_id)
      if (!token.success) {
        await e.reply([segment.at(e.user_id), '\n', token.message])
        return true
      }
      const instanceid = rule.appList.reg.exec(e.msg)[1]
      const res = await api.IClientCommService.GetClientAppList(token.accessToken, instanceid)
      if (!res) {
        await e.reply([segment.at(e.user_id), '\n', '没有获取到客户端游戏列表', instanceid ? ' 请检查instanceid是否正确' : ''])
        return true
      }
      // 需要更新的游戏
      const updateList = []
      // 已安装的游戏
      const installList = []
      // 未安装的游戏
      const uninstallList = []
      res.apps.forEach(i => {
        if (i.app_type !== 'game') {
          return
        }
        const info = {
          appid: i.appid,
          name: i.app
        }
        if (i.installed) {
          if (i.target_buildid && i.target_buildid !== i.source_buildid) {
            // 还可以细分
            // queue_position -1: 未安排下载 0: 已安排
            // rt_time_scheduled: 计划下载时间
            // download_paused true: 暂停下载 false: 正在下载
            updateList.push({
              ...info,
              desc: `${formatBytes(i.bytes_downloaded)} / ${formatBytes(i.bytes_to_download)}`
            })
          } else {
            installList.push(info)
          }
        } else {
          uninstallList.push(info)
        }
      })
      const data = []
      if (updateList.length) {
        data.push({
          title: '有更新的游戏',
          games: updateList
        })
      }
      if (installList.length) {
        data.push({
          title: '已安装的游戏',
          games: installList
        })
      }
      if (uninstallList.length) {
        data.push({
          title: '未安装的游戏',
          games: uninstallList
        })
      }
      if (!data.length) {
        await e.reply([segment.at(e.user_id), '\n', '游戏列表为空'])
        return true
      }
      const img = await Render.render('inventory/index', {
        data
      })
      await e.reply(img)
      return true
    }
  },
  install: {
    reg: App.getReg(`${baseReg}(?:安装|下载)(?:游戏)?\\s*(\\d*)\\s*(\\d*)`),
    fnc: async e => {
      const token = await utils.steam.getAccessToken(e.user_id)
      if (!token.success) {
        await e.reply([segment.at(e.user_id), '\n', token.message])
        return true
      }
      const appid = rule.install.reg.exec(e.msg)[1]
      const instanceid = rule.install.reg.exec(e.msg)[2]
      if (!appid) {
        await e.reply([segment.at(e.user_id), '\n', '请输入appid'])
        return true
      }
      await api.IClientCommService.InstallClientApp(token.accessToken, appid, instanceid)
      await e.reply([segment.at(e.user_id), '\n', '已发送安装请求'])
      return true
    }
  },
  launch: {
    reg: App.getReg(`${baseReg}(?:启动|打开)(?:游戏)?\\s*(\\d*)\\s*(\\d*)`),
    fnc: async e => {
      const token = await utils.steam.getAccessToken(e.user_id)
      if (!token.success) {
        await e.reply([segment.at(e.user_id), '\n', token.message])
        return true
      }
      const appid = rule.launch.reg.exec(e.msg)[1]
      const instanceid = rule.launch.reg.exec(e.msg)[2]
      if (!appid) {
        await e.reply([segment.at(e.user_id), '\n', '请输入appid'])
        return true
      }
      await api.IClientCommService.LaunchClientApp(token.accessToken, appid, instanceid)
      await e.reply([segment.at(e.user_id), '\n', '已发送启动请求'])
      return true
    }
  },
  uninstall: {
    reg: App.getReg(`${baseReg}(?:卸载|删除)(?:游戏)?\\s*(\\d*)\\s*(\\d*)`),
    fnc: async e => {
      const token = await utils.steam.getAccessToken(e.user_id)
      if (!token.success) {
        await e.reply([segment.at(e.user_id), '\n', token.message])
        return true
      }
      const appid = rule.uninstall.reg.exec(e.msg)[1]
      const instanceid = rule.uninstall.reg.exec(e.msg)[2]
      if (!appid) {
        await e.reply([segment.at(e.user_id), '\n', '请输入appid'])
        return true
      }
      await api.IClientCommService.UninstallClientApp(token.accessToken, appid, instanceid)
      await e.reply([segment.at(e.user_id), '\n', '已发送卸载请求'])
      return true
    }
  },
  download: {
    reg: App.getReg(`${baseReg}(?:恢复|暂停|停止|继续)(?:下载|更新)?(?:游戏)?\\s*(\\d*)\\s*(\\d*)`),
    fnc: async e => {
      const token = await utils.steam.getAccessToken(e.user_id)
      if (!token.success) {
        await e.reply([segment.at(e.user_id), '\n', token.message])
        return true
      }
      const appid = rule.download.reg.exec(e.msg)[1]
      const instanceid = rule.download.reg.exec(e.msg)[2]
      if (!appid) {
        await e.reply([segment.at(e.user_id), '\n', '请输入appid'])
        return true
      }
      const download = /(恢复|继续)/.test(e.msg)
      await api.IClientCommService.SetClientAppUpdateState(token.accessToken, appid, download, instanceid)
      await e.reply([segment.at(e.user_id), '\n', `已发送${download ? '继续' : '暂停'}下载请求`])
      return true
    }
  }
}

function formatBytes (bytes, fractionDigits = 2) {
  if (!bytes) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(fractionDigits))} ${sizes[i]}`
}

export const app = new App(appInfo, rule).create()
