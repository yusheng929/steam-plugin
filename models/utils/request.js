import axios from 'axios'
import { Config } from '#components'
import { HttpProxyAgent } from 'http-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { logger, redis } from '#lib'
import moment from 'moment'

const redisKey = 'steam-plugin'
// api请求次数前缀
const redisApiKey = `${redisKey}:api:`
// 429的key前缀
const redis429Key = `${redisKey}:429key:`
// key使用次数前缀
const redisUseKey = `${redisKey}:useKey:`

/**
 * 通用请求方法
 * @param {string} url
 * @param {import('axios').AxiosRequestConfig} options
 * @returns {Promise<import('axios').AxiosResponse<any>>}
 */
export default async function request (url, options = {}, retry = { count: 0, keys: Config.steam.apiKey }) {
  const steamApi = (() => {
    const url = 'https://api.steampowered.com'
    if (Config.steam.commonProxy) {
      return Config.steam.commonProxy.replace('{{url}}', url)
    } else if (Config.steam.apiProxy) {
      return Config.steam.apiProxy.replace(/\/$/, '')
    } else {
      return url
    }
  })()
  // 最大重试次数
  const maxRetry = Math.max(Math.ceil(Config.steam.apiKey.length * 1.5), 3)

  const baseURL = options.baseURL ?? steamApi
  logger.info(`开始请求api: ${url}`)

  const now = moment().format('YYYY-MM-DD')
  incr(`${redisApiKey}${now}:${url}`)

  const start = Date.now()
  let key = ''
  let keys = []
  const needKeyFlag = baseURL === steamApi && !options.params?.access_token
  if (needKeyFlag) {
    let { retKeys, retKey } = await getKey(retry.keys)
    key = retKey
    keys = retKeys
    logger.info(`获取请求的key: ${key.slice(0, 5)}...${key.slice(-5)}`)
  }
  return await axios.request({
    url,
    baseURL,
    httpAgent: Config.steam.proxy ? new HttpProxyAgent(Config.steam.proxy) : undefined,
    httpsAgent: Config.steam.proxy ? new HttpsProxyAgent(Config.steam.proxy) : undefined,
    ...options,
    params: {
      key: key || undefined,
      l: 'schinese',
      cc: 'CN',
      language: 'schinese',
      ...options.params
    },
    timeout: Config.steam.timeout * 1000
  }).then(res => {
    logger.info(`请求api成功: ${url}, 耗时: ${Date.now() - start}ms`)
    // 缓存使用的key
    if (key) { incr(`${redisUseKey}${now}:${key}`, 7) }
    return res.data
  }).catch(err => {
    if (err.status === 429 && keys.length > 1 && key && retry.count < maxRetry) {
      // 十分钟内不使用相同的key
      redis.set(`${redis429Key}${key}`, 1, { EX: 60 * 10 })
      retry.count++
      retry.keys = keys.filter(k => k !== key)
      logger.error(`请求api失败: ${url}, 状态码: ${err.status}, 更换apiKey开始重试第${retry.count}次`)
      return request(url, options, retry)
    }
    throw err
  })
}

/**
 * get 请求方法
 * @param {string} url
 * @param {import('axios').AxiosRequestConfig} options
 * @returns {Promise<import('axios').AxiosResponse<any>>}
 */
export async function get (url, options = {}) {
  return await request(url, {
    ...options,
    method: 'GET'
  })
}

/**
 * post 请求方法
 * @param {string} url
 * @param {import('axios').AxiosRequestConfig} options
 * @returns {Promise<import('axios').AxiosResponse<any>>}
 */
export async function post (url, options = {}) {
  return await request(url, {
    ...options,
    method: 'POST'
  })
}

async function getKey (keys = Config.steam.apiKey) {
  const i = []
  const now = moment().format('YYYY-MM-DD')
  if (keys.length > 1) {
    for (const key of keys) {
      if (!await redis.exists(`${redis429Key}${key}`)) {
        i.push(key)
      }
    }
    if (i.length === 0) {
      i.push(keys[0])
    }
  } else {
    i.push(...keys)
  }
  let key = i[0]
  if (i.length === 1) {
    return { retKeys: i, retKey: key }
  }
  const keyNowUses = await redis.keys(`${redisUseKey}${now}:*`)
  if (keyNowUses.length === 0) {
    return { retKeys: i, retKey: key }
  }
  const keyUses = await redis.mGet(keyNowUses)
  const keyUseMap = new Map()
  for (let i = 0; i < keyNowUses.length; i++) {
    keyUseMap.set(keyNowUses[i].split(':').pop(), Number(keyUses[i]))
  }
  let count = 0
  // 获取使用次数最少的key
  for (const k of i) {
    const use = keyUseMap.get(`${k}`)
    if (!use) {
      key = k
      break
    }
    if (use < count) {
      count = use
      key = k
    }
  }
  return { retKeys: i, retKey: key }
}

function incr (key, day = 3) {
  redis.incr(key).then((i) => {
    if (i == 1 && day > 0) {
      redis.expire(key, 60 * 60 * 24 * day).catch(() => {})
    }
  }).catch(() => {})
}
