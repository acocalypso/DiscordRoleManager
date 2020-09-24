# DiscordRoleManager
> Manage Discord Roles the lazzyyy way


## Installation

- Create a new discord Bot -> [GUIDE](https://discordpy.readthedocs.io/en/latest/discord.html)
- Invite the Bot to your Discord Server
	- Check the boxes for the needed permissions
	- Minimum requirements: manage roles and send messages
	- Manage roles, it will only be able to manage roles that are below his role/permissions
	- Use the URL that page generates and go to it, and you will be asked to log into your discord. You will need Admin access in order to get the bot to join that server.
- Rename config.json.example to config.json
- Edit config.json and fill out the required infos.


```sh
{
  "token": "", // your bot token
  "botID": "", // your bot id
  "ownerID": "", // discord bot owner (usually the one who is using the bot)
  "serverName": "", // discord Server Name
  "serverID": "", // discord Server ID
  "language": "", // de,en,pt
  "cmdPrefix": "?", // prefix for commands
  "adminRoleName": "", // Name of the Admin Role
  "modRoleName": "", // Name of the moderator Role
  "mapMain": {
    "enabled": "yes", // yes or no
    "url": "https://yourmap.com" // link to your site / map
  },
  "paypal": {
    "enabled": "yes", // yes or no
    "url": "https://www.paypal.me/xyz", // URL to your paypal donation site
    "img": "https://raw.githubusercontent.com/acocalypso/DiscordRoleManager/master/paypal_icon.jpg"
  },
  "mainChannelID": "" //channel where admin / mod infos are posted
}

```
Install node dependecies

```
npm install
```

Now start the bot

```
node start.js
```

You may want to use pm2 or systemd to run it as a service

## Usage example

```
User commands:

(prefix)check » to check the time left on your subscription
(prefix)map » a link to our web map
(prefix)subscribe or (prefix)paypal » for a link to your PayPal account

Admin / Mod commands:

(prefix)temprole @mention <DAYS> <ROLE-NAME> » to assign a temporary roles
(prefix)temprole add @mention <DAYS> » to add more time to a temporary role assignment
(prefix)temprole remove @mention » to remove a temporary role assignment
(prefix)temprole check @mention » to check the time left on a temporary role assignment

Help commands:

(prefix)help » display help commands
(prefix)help mods >> display mod commands
```


## Additional IMPORTANT Infos:
This is a port from https://github.com/Kneckter/DiscordRoleBot

Many thanks to him for his original (no longer supported) version.

Used libs:
- ErisJS
- sqlite3
