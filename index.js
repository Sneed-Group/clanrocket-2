require('dotenv').config(); // Load environment variables from .env file
const { Client, Intents } = require('discord.js');
const client = new Client({ 
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES // Add intents as needed
    ]
});
const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { QuickDB } = require("quick.db");
const express = require('express');

// Initialize Express.js app
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize the DB
const db = new QuickDB();

// Retrieve Application ID from environment variable
const applicationId = process.env.DISCORD_APPLICATION_ID;

if (!applicationId) {
    console.error('Application ID not found in environment variables.');
    process.exit(1); // Exit the process if application ID is missing
}

// Set up Discord slash commands
const commands = [
    new SlashCommandBuilder()
        .setName('xp')
        .setDescription('View your XP or someone else\'s XP')
        .addUserOption(option => option.setName('user').setDescription('The user to view XP for')),
    new SlashCommandBuilder()
        .setName('addxp')
        .setDescription('Add XP to yourself or someone else (admin only)')
        .addIntegerOption(option => option.setName('amount').setDescription('The amount of XP to add'))
        .addUserOption(option => option.setName('user').setDescription('The user to add XP to')),
    new SlashCommandBuilder()
        .setName('removexp')
        .setDescription('Remove XP from yourself or someone else (admin only)')
        .addIntegerOption(option => option.setName('amount').setDescription('The amount of XP to remove'))
        .addUserOption(option => option.setName('user').setDescription('The user to remove XP from')),
].map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        if (applicationId) {
            await rest.put(
                Routes.applicationCommands(applicationId),
                { body: commands },
            );
            console.log('Successfully reloaded application (/) commands.');
        } else {
            console.error('Application ID not found.');
        }
    } catch (error) {
        console.error(error);
    }
})();

// Discord.js event listener for when the bot is ready
client.once('ready', () => {
    console.log('Bot is ready!');
});

// Discord.js event listener for when a message is received
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // Increment XP every 10 messages
    if (message.guild) {
        const guildId = message.guild.id;
        const xp = await db.get(`xp.${guildId}.${message.author.id}`) || 0;
        await db.set(`xp.${guildId}.${message.author.id}`, xp + 1);

        // Check if user leveled up
        const level = Math.floor(xp / 5) + 1;
        const newLevel = Math.floor((xp + 1) / 5) + 1;
        if (newLevel > level) {
            message.channel.send(`${message.author.username} leveled up to level ${newLevel}!`);
        }
    }
});

// Discord.js event listener for when a slash command is used
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options, guildId } = interaction;

    // Retrieve guild ID from interaction if available
    const interactionGuildId = guildId || interaction.guildId;

    if (!interactionGuildId) {
        console.error('Unable to retrieve guild ID.');
        return;
    }

    if (commandName === 'xp') {
        const guildId = interactionGuildId;
        const user = options.getUser('user') || interaction.user;
        const xp = await db.get(`xp.${guildId}.${user.id}`) || 0;
        console.log(xp)
        await interaction.reply(`${user.username} has ${xp} XP.`);
    } else if (commandName === 'addxp') {
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            return interaction.reply('You do not have permission to use this command.');
        }

        const guildId = interactionGuildId;
        const amount = options.getInteger('amount');
        const user = options.getUser('user') || interaction.user;
        const currentXp = await db.get(`xp.${guildId}.${user.id}`) || 0;
        await db.set(`xp.${guildId}.${user.id}`, currentXp + amount)
        await interaction.reply(`${amount} XP added to ${user.username}.`);
    } else if (commandName === 'removexp') {
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            return interaction.reply('You do not have permission to use this command.');
        }

        const guildId = interactionGuildId;
        const amount = options.getInteger('amount');
        const user = options.getUser('user') || interaction.user;
        const currentXp = await db.get(`xp.${guildId}.${user.id}`) || 0;
        await db.set(`xp.${guildId}.${user.id}`, Math.max(0, currentXp - amount));
        await interaction.reply(`${amount} XP removed from ${user.username}.`);
    }
});

// Start the Express.js server for the XP API
app.get('/xp/:guildId/:userId', (req, res) => {
    const { guildId, userId } = req.params;
    const xp = db.get(`xp.${guildId}.${userId}`) || 0;
    res.json({ guildId, userId, xp });
});

app.listen(PORT, () => {
    console.log(`XP API server is running on http://localhost:${PORT}`);
});

// Login to Discord
client.login(process.env.DISCORD_BOT_TOKEN);
