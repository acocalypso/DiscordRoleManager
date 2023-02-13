# DiscordRoleManager

> Manage Discord Roles the lazzyyy way

THIS IS IN PREPREPREALPHA thinkering stadium - not usable in case don't even look at it.

Main Goal.

Integration of Wordpress Woocommerce and mollie Payment to receive a semi automated payment and role system.
Create PromoCode for giveaways.
Users can assign their roles themselfe after purchasing a certain timeperiod.

## Installation

- Create a new discord Bot -> [GUIDE](https://discordpy.readthedocs.io/en/latest/discord.html)
- Invite the Bot to your Discord Server
  - Check the boxes for the needed permissions
  - Minimum requirements: manage roles and send messages
  - Manage roles, it will only be able to manage roles that are below his role/permissions
  - Enable PRESENCE INTENT, SERVER MEMBERS INTENT and MESSAGE CONTENT INTENT
  - Use the URL that page generates and go to it, and you will be asked to log into your discord. You will need Admin access in order to get the bot to join that server.
- Rename config.json.example to config.json
- Edit config.json and fill out the required infos.
- Create a Mysql Database
- If you used DiscordRoleManager before, backup your dataBase.sqlite
- update to latest master
- copy your dataBase.sqlite file back. The Bot will migrate all users from sqlite to mysql.

Even if you have this bot only on a single discord server you have to set the guild ID and register the bot.

As a Workaround to use the multiguild feature and not to crash the bot please manually set the guild_id for all users in the db.
(This will be fixed later after I figured out how to)

```update temporary_roles set guild_id = YOURGUILDID where guild_id is null;```

For the first run please register the bot this will save guildID and guildName to DB

```
(prefix)register
```

After that please register the Admin and Moderator Role and channel + adminchannel

channel: In this channel the bot accepts commands
adminchannel: The bot will send information about expired or soon to expire users as well as additional information if issues occurs.

```
(prefix)register adminrole @AdminRole
(prefix)register modrole @ModRole
(prefix)register channel #mainchannelforthebotinformation
(prefix)register adminchannel #adminchannel
```

```sh
#Please remove all comments as this is currently not handled by the bot!

{
  "token": "", // Bot token
  "clientID": "", // bot client id
  "clientSecret": "", //bot client secret
  "ownerID": "", // Your discord id
  "defaultDonatorRole": "1234567896548" // default donator role if you don't want to specify it in the command
  "language": "", // en, de, pt, nl, fr
  "cmdPrefix": "?", // choose your command prefix
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

## Usage example

```
User commands:

(prefix)check @rolename » to check the time left on your subscription
(prefix)map » a link to our web map
(prefix)subscribe or (prefix)paypal » for a link to your PayPal account

Admin / Mod commands:

(prefix)temprole @mention <DAYS> @rolename » to assign a temporary roles
(prefix)temprole add @mention <DAYS> @rolename » to add more time to a temporary role assignment
(prefix)temprole remove @mention @rolename » to remove a temporary role assignment
(prefix)temprole check @mention @rolename » to check the time left on a temporary role assignment

Help commands:

(prefix)help » display help commands
(prefix)help mods >> display mod commands
```

## Grafana 8.x Support

![alt text](https://raw.githubusercontent.com/acocalypso/DiscordRoleManager/master/grafana_donators.PNG)

## Contribution

You can find the local.json file in locale/local.json

if you want to add another langue you just need to add a new entry in the json file like:

```
  "Ready": {
    "de": "Bereit!",
    "cz": "připraven"
  },
```

## Additional IMPORTANT Infos

This is a port from <https://github.com/Kneckter/DiscordRoleBot>

Many thanks to him for his original version.
