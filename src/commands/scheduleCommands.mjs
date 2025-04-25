import { SlashCommandBuilder } from 'discord.js';
import { RedditService } from '../services/redditService.mjs';

export const scheduleCommands = [
    new SlashCommandBuilder()
        .setName('schedule')
        .setDescription('Schedule a post action')
        .addSubcommand(subcommand =>
            subcommand
                .setName('lock')
                .setDescription('Schedule a post to be locked')
                .addStringOption(option =>
                    option.setName('postlink')
                        .setDescription('The link to the post')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('time')
                        .setDescription('The epoch timestamp (in milliseconds) to lock the post')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('unlock')
                .setDescription('Schedule a post to be unlocked')
                .addStringOption(option =>
                    option.setName('postlink')
                        .setDescription('The link to the post')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('time')
                        .setDescription('The epoch timestamp (in milliseconds) to unlock the post')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all pending scheduled locks and unlocks'))
].map(command => command.toJSON());

export async function handleScheduleCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'list') {
        return handleListCommand(interaction);
    }

    const postLink = interaction.options.getString('postlink');
    const time = interaction.options.getString('time');

    let epochTime = parseInt(time, 10);

    if (isNaN(epochTime)) {
        console.error('Invalid epoch timestamp.');
        await interaction.reply('Invalid epoch timestamp. Please provide a valid number.');
        return;
    }

    if (epochTime < 1000000000000) {
        epochTime *= 1000;
    }

    if (epochTime <= Date.now()) {
        await interaction.reply('Invalid epoch timestamp. Please provide a valid future timestamp.');
        return;
    }

    const action = subcommand === 'lock' ? 'lock' : 'unlock';
    await interaction.reply({
        content: `Scheduled to ${action} the [post](${postLink}) at <t:${Math.floor(epochTime / 1000)}:F> (<t:${Math.floor(epochTime / 1000)}:R>)`,
        ephemeral: true
    });
    await interaction.channel.send({
        embeds: [{
            title: `Post ${action.charAt(0).toUpperCase() + action.slice(1)} Scheduled`,
            description: `The [post](${postLink}) has been scheduled to be ${action}ed`,
            fields: [
                { name: `Moderator`, value: `Scheduled by: ${interaction.user.username}` },
                { name: 'Scheduled Time', value: `<t:${Math.floor(epochTime / 1000)}:F> (<t:${Math.floor(epochTime / 1000)}:R>)` }
            ],
            color: 0x00FF00
        }],
    });

    if (!global.scheduledActions) {
        global.scheduledActions = [];
    }
    global.scheduledActions.push({ action, postLink, epochTime });
    scheduleAction(action, postLink, epochTime, interaction);
}

async function handleListCommand(interaction) {
    if (!global.scheduledActions || global.scheduledActions.length === 0) {
        await interaction.reply({
            content: 'There are no pending scheduled actions.',
            ephemeral: true
        });
        return;
    }

    const now = Date.now();
    const pendingLocks = global.scheduledActions.filter(action => action.action === 'lock' && action.epochTime > now);
    const pendingUnlocks = global.scheduledActions.filter(action => action.action === 'unlock' && action.epochTime > now);

    const lockEmbed = {
        title: 'Pending Locks',
        description: pendingLocks.length > 0
            ? pendingLocks.map(action => `**Post**: [here](${action.postLink})\n**Time**: <t:${Math.floor(action.epochTime / 1000)}:F> (<t:${Math.floor(action.epochTime / 1000)}:R>)`).join('\n\n')
            : 'No pending locks.',
        color: 0xFFA500
    };

    const unlockEmbed = {
        title: 'Pending Unlocks',
        description: pendingUnlocks.length > 0
            ? pendingUnlocks.map(action => `**Post**: [here](${action.postLink})\n**Time**: <t:${Math.floor(action.epochTime / 1000)}:F> (<t:${Math.floor(action.epochTime / 1000)}:R>)`).join('\n\n')
            : 'No pending unlocks.',
        color: 0x00FFFF
    };

    await interaction.reply({
        embeds: [lockEmbed, unlockEmbed],
        ephemeral: true
    });
}

function scheduleAction(action, postLink, epochTime, interaction) {
    const currentTime = Date.now();
    const timeMs = epochTime - currentTime;

    if (timeMs <= 0) {
        console.error('Invalid epoch time: Time must be in the future');
        return;
    }

    setTimeout(async () => {
        const redditService = new RedditService();
        try {
            if (action === 'lock') {
                await redditService.lockPost(postLink);
                console.log(`Post locked successfully: ${postLink}`);
                await interaction.channel.send({
                    embeds: [{
                        title: 'Post Locked',
                        description: `The [post](${postLink}) has been successfully locked.`,
                        fields: [
                            { name: `Moderator`, value: `Scheduled by: ${interaction.user.username}` },
                        ],
                        color: 0x00FF00
                    }]
                });
            } else if (action === 'unlock') {
                await redditService.unlockPost(postLink);
                console.log(`Post unlocked successfully: ${postLink}`);
                await interaction.channel.send({
                    embeds: [{
                        title: 'Post Unlocked',
                        description: `The [post](${postLink}) has been successfully unlocked.`,
                        fields: [
                            { name: `Moderator`, value: `Scheduled by: ${interaction.user.username}` },
                        ],
                        color: 0x00FF00
                    }]
                });
            }
        } catch (error) {
            console.error(`Failed to ${action} post: ${postLink}`, error);
            await interaction.followUp({
                embeds: [{
                    title: `Failed to ${action} Post`,
                    description: `An error occurred while trying to ${action} the post: [Link](${postLink})`,
                    color: 0xFF0000,
                    fields: [
                        { name: 'Error', value: error.message || 'Unknown error' }
                    ]
                }]
            });
        }
    }, timeMs);
}
