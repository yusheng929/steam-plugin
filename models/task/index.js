import * as play from './play.js'
import * as familyInventory from './familyInventory.js'
import * as userInventory from './userInventory.js'
import * as userWishlist from './userWishlist.js'

export function startTask () {
  play.startTimer()
  familyInventory.startTimer()
  userInventory.startTimer()
  userWishlist.startTimer()
}

export {
  play,
  familyInventory,
  userInventory,
  userWishlist
}
