# DiscordRoleManager

> Manage Discord Roles the lazzyyy way

## Installation

- Create a new discord Bot -> [GUIDE](https://discordpy.readthedocs.io/en/latest/discord.html)
- Invite the Bot to your Discord Server
  - Check the boxes for the needed permissions
  - Minimum requirements: manage roles and send messages
  - Manage roles, it will only be able to manage roles that are below his role/permissions
  - Enable PRESENCE INTENT, SERVER MEMBERS INTENT and MESSAGE CONTENT INTENT
  - Use the URL that page generates and go to it, and you will be asked to log into your discord. You will need Admin access in order to get the bot to join that server.
- Rename config.json.example to config.json
- Edit config.json and fill out the required infos (token + clientID required). Set guildID for instant slash command updates.
- Create a Mysql Database
- If you used DiscordRoleManager before, backup your dataBase.sqlite
- update to latest master
- copy your dataBase.sqlite file back. The Bot will migrate all users from sqlite to mysql.

Even if you have this bot only on a single discord server you have to set the guild ID and register the bot.

As a Workaround to use the multiguild feature and not to crash the bot please manually set the guild_id for all users in the db.
(This will be fixed later after I figured out how to)

```update temporary_roles set guild_id = YOURGUILDID where guild_id is null;```

For the first run please register the bot via slash command. This saves guild setup to the DB.

```
/register
```

The /register flow is interactive (modal). It will ask for:
- Admin role ID
- Mod role ID
- Main channel ID (where the bot accepts commands)
- Admin channel ID (expiry alerts and admin info)

```sh
#Please remove all comments as this is currently not handled by the bot!

{
  "token": "", // Bot token
  "clientID": "", // bot client id (required for slash commands)
  "guildID": "", // optional: guild id for instant slash command updates
  "clientSecret": "", //bot client secret
  "ownerID": "", // Your discord id
  "defaultDonatorRole": "1234567896548" // default donator role if you don't want to specify it in the command
  "language": "", // en, de, pt, nl, fr
  "cmdPrefix": "?", // legacy only (slash commands are used now)
  "checkIntervall": 60, // check every 60 min for expired or soon to expire users
  "migrateSQLITE": {
    "migrate": true, // do you want to migrate your user from sqlite?
    "path": "" // path to your sqlite file
  },
  "debug": "no", // enable / disable debug infos
  "webinterface": {
    "disabled": "yes", //enable webinterface
    "backendPort": 9000, // interface port
    "username": "admin", // your login username - This can be removed afterwards
    "password": "SuperSecretPW", // your login password - This can be removed afterwards
    "secret": "ThisShouldBeChanged" // session secret
  },
  "mapMain": {
    "enabled": "yes", // enable link to your map
    "url": "https://yourmap.com" // your map link
  },
  "paypal": {
    "enabled": "yes", // enable paypal link
    "url": "https://www.paypal.me/xyz", // your paypal url
    "img": "https://raw.githubusercontent.com/acocalypso/DiscordRoleManager/master/paypal_icon.jpg"
  },
  "mysql_database": {
    "mysql_host": "localhost", // your mysql host
    "mysql_port": 3306, // mysql port
    "mysql_db": "rolemanager", // mysql database for rolemanager
    "mysql_user": "dummy", // mysql username
    "mysql_pass": "dummy" // mysql password
  },
    "specialmode": {
    "enabled": "yes",
    "hideRole": "1263456789" //define role which should be applied if user looses role
  }
}

```

## Install node dependecies

Install NodeJS version 16.x!

```
npm install
```

Now start the bot

```
node start.js
```

You may want to use pm2 or systemd to run it as a service

## Docker

DiscordRoleManager is now also available as a docker image.

```
docker-compose pull
docker-compose up -d
```

## Usage example (Slash Commands)

```
User commands:

/check [role] » check the time left on your subscription
/map » a link to the web map
/paypal » link to PayPal

Admin / Mod commands:

/temprole add <user> <days> [role] » assign a temporary role
/temprole remove <user> [role] » remove a temporary role assignment
/temprole check <user> [role] » check a temporary role assignment

Help commands:

/help » display help commands
/help scope:mods » display mod commands
```

## Grafana 8.x Support

![alt text](https://raw.githubusercontent.com/acocalypso/DiscordRoleManager/master/grafana_donators.PNG)

## Contribution

You can find language files in locale/<lang>.json

If you want to add another language, copy locale/en.json to locale/<lang>.json and translate values.

## Additional IMPORTANT Infos

This is a port from <https://github.com/Kneckter/DiscordRoleBot>

Many thanks to him for his original version.
