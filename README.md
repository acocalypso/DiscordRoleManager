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
- Edit config.json and fill out the required infos.
- Create a Mysql Database
- If you used DiscordRoleManager before, backup your dataBase.sqlite 
- update to latest master 
- copy your dataBase.sqlite file back. The Bot will migrate all users from sqlite to mysql.

Even if you have this bot only on a single discord server you have to set the guild ID and register the bot.

As a Workaround to use the multiguild feature and not to crash the bot please manually set the guild_id for all users in the db.
(This will be fixed later after I figured out how to)

```update temporary_roles set guild_id = YOURGUILDID where guild_id is null;```

For the first run please register the bot with
```
(prefix)register
```
After that please register the Admin and Moderator Role with
```
(prefix)register adminrole @AdminRole
(prefix)register modrole @ModRole
(prefix)register channel #mainchannelforthebotinformation
```

```sh
#Please remove all comments as this is currently not handled by the bot!

{
  "token": "", // Bot token
  "clientID": "", // bot client id
  "clientSecret": "", //bot client secret
  "ownerID": "", // Your discord id
  "language": "", // en, de, pt, nl
  "cmdPrefix": "?", // choose your command prefix
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
  }
}


```
Install node dependecies

Install NodeJS version 16.x!

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

Many thanks to him for his original version.
