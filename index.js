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
const db = require('quick.db');
const express = require('express');

// Initialize Express.js app
const app = express();
const PORT = process.env.PORT || 3000;

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

        const applicationId = client.application?.id;
        const guildId = client.guilds.cache.first()?.id;

        if (applicationId && guildId) {
            await rest.put(
                Routes.applicationGuildCommands(applicationId, guildId),
                { body: commands },
            );
            console.log('Successfully reloaded application (/) commands.');
        } else {
            console.error('Unable to retrieve application or guild ID.');
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
        const xp = db.get(`xp.${message.author.id}`) || 0;
        db.set(`xp.${message.author.id}`, xp + 1);

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

    const { commandName, options } = interaction;

    if (commandName === 'xp') {
        const user = options.getUser('user') || interaction.user;
        const xp = db.get(`xp.${user.id}`) || 0;
        interaction.reply(`${user.username} has ${xp} XP.`);
    } else if (commandName === 'addxp') {
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            return interaction.reply('You do not have permission to use this command.');
        }

        const amount = options.getInteger('amount');
        const user = options.getUser('user') || interaction.user;
        const currentXp = db.get(`xp.${user.id}`) || 0;
        db.set(`xp.${user.id}`, currentXp + amount);
        interaction.reply(`${amount} XP added to ${user.username}.`);
    } else if (commandName === 'removexp') {
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            return interaction.reply('You do not have permission to use this command.');
        }

        const amount = options.getInteger('amount');
        const user = options.getUser('user') || interaction.user;
        const currentXp = db.get(`xp.${user.id}`) || 0;
        db.set(`xp.${user.id}`, Math.max(0, currentXp - amount));
        interaction.reply(`${amount} XP removed from ${user.username}.`);
    }
});

// Start the Express.js server for the XP API
app.get('/xp/:userId', (req, res) => {
    const userId = req.params.userId;
    const xp = db.get(`xp.${userId}`) || 0;
    res.json({ userId, xp });
});

app.listen(PORT, () => {
    console.log(`XP API server is running on http://localhost:${PORT}`);
});

// Login to Discord
client.login(process.env.DISCORD_BOT_TOKEN);
