# DiscordRoleManager
> Manage Discord Roles the lazzyyy way


## Installation

- Create a new discord Bot -> [GUIDE](https://discordpy.readthedocs.io/en/latest/discord.html)
- Invite the Bot to your Discord Server
	- Check the boxes for the needed permissions
	- Minimum requirements: manage roles and send messages
	- Manage roles, it will only be able to manage roles that are below his role/permissions
	- Enable PRESENCE INTENT and SERVER MEMBERS INTENT
	- Use the URL that page generates and go to it, and you will be asked to log into your discord. You will need Admin access in order to get the bot to join that server.
- Rename config.json.example to config.json
- Edit config.json and fill out the required infos.
- Create a Mysql Database
- If you used DiscordRoleManager before, backup your dataBase.sqlite 
- update to latest master 
- copie your dataBase.sqlite file back. The Bot will migrate all users from sqlite to mysql.

```sh
{
  "token": "", // your bot token
  "botID": "", // your bot id
  "ownerID": "", // discord bot owner (usually the one who is using the bot)
  "serverName": "", // discord Server Name
  "serverID": "", // discord Server ID
  "language": "", // en, de
  "cmdPrefix": "?", // prefix for commands
  "adminRoleName": "", // Name of the Admin Role
  "modRoleName": "", // Name of the moderator Role
  "debug": "no",
  "mapMain": {
    "enabled": "yes", // yes or no
    "url": "https://yourmap.com" // link to your site / map
  },
  "paypal": {
    "enabled": "yes", // yes or no
    "url": "https://www.paypal.me/xyz", // URL to your paypal donation site
    "img": "https://raw.githubusercontent.com/acocalypso/DiscordRoleManager/master/paypal_icon.jpg"
  },
  "mainChannelID": "", //channel where admin / mod infos are posted
  "telegram": {		// Support for https://github.com/Micha854/full_auto_abo_telegram/ usermanagement.
    "tele_enabled": "yes",
    "tele_db_host": "",
    "tele_db_name": "",
    "tele_db_port": "",
    "tele_db_user": "",
    "tele_db_pass": ""
  },
  "mysql_database": {
    "mysql_host": "localhost",
    "mysql_port": 3306,
    "mysql_db": "rolemanager",
    "mysql_user": "dummy",
    "mysql_pass": "dummy"
  }
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

(prefix)check <ROLE-NAME> » to check the time left on your subscription
(prefix)map » a link to our web map
(prefix)subscribe or (prefix)paypal » for a link to your PayPal account

Admin / Mod commands:

(prefix)temprole @mention <DAYS> <ROLE-NAME> » to assign a temporary roles
(prefix)temprole add @mention <DAYS> <ROLE-NAME> » to add more time to a temporary role assignment
(prefix)temprole remove @mention <ROLE-NAME> » to remove a temporary role assignment
(prefix)temprole check @mention <ROLE-NAME> » to check the time left on a temporary role assignment

full_auto_abo_telegram https://github.com/Micha854/full_auto_abo_telegram/
(prefix)telegram @telegramuser days
(prefix)telegram add @telegramuser days
(prefix)telegram check @telegramuser

Help commands:

(prefix)help » display help commands
(prefix)help mods >> display mod commands
```

## Grafana 8.x Support

![alt text](https://raw.githubusercontent.com/acocalypso/DiscordRoleManager/backend/grafana_donators.PNG)

## Contribution:

You can find the local.json file in locale/local.json

if you want to add another langue you just need to add a new entry in the json file like:

```
  "Ready": {
    "de": "Bereit!",
    "cz": "připraven"
  },
```

## Additional IMPORTANT Infos:
This is a port from https://github.com/Kneckter/DiscordRoleBot

Many thanks to him for his original (no longer supported) version.

Used libs:
- ErisJS
- sqlite3
- mysql
- i18n-nodejs