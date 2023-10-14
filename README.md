# AgmaClient
AgmaClient is a simple proof-of-concept API that I made in 2021 for interacting with the free-to-play multiplayer MMO web game [agma.io](https://agma.io/).

The inspiration for this API was driven based off the popular web game [agar.io](https://agar.io/).
Agma is similar to Agar.io but with different physics and game modes; over the past few years, Agar.io has tightened their client-side security incredibly,
so Agma was more feasible to reverse engineer and develop an API for.

# API

## Methods
| Signature                                          | Description                                                                              |
|----------------------------------------------------|------------------------------------------------------------------------------------------|
| `AgmaClient(): AgmaClient`                         | create an `AgmaClient` instance (note it is extended from `EventEmitter`)                |
| `setProxy(agent: string)`                          | sets the client's proxy (must be called before `connect(...)`)                           |
| `async connect(address: string): Promise`          | attempt a connection to an Agma server                                                   |
| `disconnect(): void`                               | disconnect from the server                                                               |
| `send(buffer: ArrayBuffer, force?: boolean): void` | send `buffer` to the server; if `force` is true, force it to be sent regardless of state |
| `sendByte(byte: number, force?: boolean): void`    | same as `send` but sends a singular byte                                                 |
| `sendSetting(id: number, data: number): void`      | transmits a specific setting to the server                                               |
| `updateMousePosition(): void`                      | transmits the value of `mousePosition` to the server                                     |
| `setMousePosition(x: number, y: number): void`     | updates the value of `mousePosition` and transmits it to the server                      |
| `spawn(nickname?: string): void`                   | spawn with name `nickname`, otherwise with a randomly generated name                     |
| `respawn(nickname?: string): void`                 | respawn with name `nickname`                                                             |
| `split(): void`                                    | split the client's cells                                                                 |
| `feed(): void`                                     | make the client feed in the direction of the current mouse position                      |

## Fields
| Name                                   | Type               | Description                                                     |
|----------------------------------------|--------------------|-----------------------------------------------------------------|
| `socketAddress`                        | `string`           | set by `connect()` (see below)                                  |
| `connected`                            | `boolean`          | whether the client is connected to a server                     |
| `playing`                              | `boolean`          | whether the client is spawned in and connected                  |
| `mousePosition`                        | `[number, number]` | tuple that contains the x and y positions of the client's mouse |
| `serverInfo`                           | `Record`           | when connected, a dict containing specific game server info     |
| `serverInfo/dimensions`                | `Record`           |                                                                 |
| `serverInfo/dimensions/left`           | `number`           |                                                                 |
| `serverInfo/dimensions/top`            | `number`           |                                                                 |
| `serverInfo/dimensions/right`          | `number`           |                                                                 |
| `serverInfo/dimensions/bottom`         | `number`           |                                                                 |
| `serverInfo/settings`                  | `Record`           |                                                                 |
| `serverInfo/settings/resolution`       | `[number, number]` | resolution of the game (for displaying in browser)              |
| `serverInfo/settings/instantCellMerge` | `boolean`          | some servers allow immediate cell merging                       |

# Example Application: Player Bots
One example of the API's usage is provided in [Examples/Bots](Examples/Bots).
The bots are treated as players by the server and will move to your mouse position until they die.

Video demonstration (I'm spectating and controlling the bots):

https://github.com/brxnnan/AgmaClient/assets/63263481/d501da4b-7fa6-4a5d-be60-03906bfd14ef

Agma has a cap on the amount of concurrent connections allowed from a singular IP, so proxies are used for having large amounts of bots connected at the same time.

[ProxyConfig.json](Examples/Bots/Server/ProxyConfig.json) overview:
* `max`: max amount of bots connected at once
* `type`: type of proxies; modifiable to support proxies of type HTTPS/SOCKS4/SOCKS5
* `joinDelayMs`: amount of delay in milliseconds between each proxy connecting to the game server

[ProxyList.txt](Examples/Bots/Server/ProxyList.txt) contains the list of proxy IPs which are used, each are separated by a new line

# Disclaimer
This project was open sourced with explicit approval from the developers and is for educational purposes only.

**Note that the majority of the [src/Security.js](src/Security.js) file is omitted** to ensure that this project can't be used maliciously (it had implementations and bypasses for a lot of the security)

# License
MIT
