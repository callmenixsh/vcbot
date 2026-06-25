const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const PREFIX = 'nya!';

client.commands = new Map();

const commandFiles = fs
    .readdirSync(path.join(__dirname, 'commands'))
    .filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.name, command);
    if (Array.isArray(command.aliases)) {
        for (const a of command.aliases) {
            client.commands.set(a, command);
        }
    }
}

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content
        .slice(PREFIX.length)
        .trim()
        .split(/\s+/);

    const cmd = args.shift()?.toLowerCase();

    const command = client.commands.get(cmd);

    if (command) {
        command.execute(message, args, client, cmd);
    }
});

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
    console.error('Missing DISCORD_TOKEN environment variable. Set it in .env or the environment.');
    process.exit(1);
}

client.login(TOKEN);