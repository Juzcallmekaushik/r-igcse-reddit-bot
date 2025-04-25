import { SlashCommandBuilder } from 'discord.js';
import { RedditService } from '../../services/redditService.mjs';
import { insertData, deleteData, fetchData } from '../../services/mongoService.mjs';

export const schedulePosts = [
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

export async function handleSchedulePosts(interaction) {
    const hasModRole = interaction.member.roles.cache.has('576460179441188864') || 
                       interaction.member.roles.cache.has('1364254995196674079') ||
                       interaction.member.roles.cache.has('668919889247076392');
    if (!hasModRole) {
        await interaction.reply({
            content: 'Not enough permissions to execute this command.',
            ephemeral: true
        });
        return;
    }

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

    const redditService = new RedditService();
    try {
        const postStatus = await redditService.getPostStatus(postLink);
        if (action === 'lock' && postStatus.isLocked) {
            await interaction.reply({
                content: 'Post has already been locked.',
                ephemeral: true
            });
            return;
        }
        if (action === 'unlock' && !postStatus.isLocked) {
            await interaction.reply({
                content: 'Post has already been unlocked.',
                ephemeral: true
            });
            return;
        }
    } catch (error) {
        console.error('Error checking post status:', error);
        await interaction.reply('Failed to check the post status. Please try again later.');
        return;
    }

    try {
        await insertData('scheduledActions', {
            action,
            postLink,
            epochTime,
            scheduledBy: interaction.user.username,
            createdAt: new Date()
        });

        await interaction.reply({
            embeds: [{
                title: `Post ${action.charAt(0).toUpperCase() + action.slice(1)} Scheduled`,
                description: `The [post](${postLink}) has been scheduled to be ${action}ed.`,
                fields: [
                    { name: 'Moderator', value: `Scheduled by: ${interaction.user.username}` },
                    { name: 'Scheduled Time', value: `<t:${Math.floor(epochTime / 1000)}:F> (<t:${Math.floor(epochTime / 1000)}:R>)` }
                ],
                color: 0x00FF00
            }],
            ephemeral: true
        });
    } catch (error) {
        console.error('Error storing scheduled action:', error);
        await interaction.reply('Failed to schedule the action. Please try again later.');
    }
}

async function handleListCommand(interaction) {
    try {
        const now = Date.now();
        const actions = await fetchData('scheduledActions', { epochTime: { $gte: now } });

        if (actions.length === 0) {
            await interaction.reply({
                content: 'There are no pending scheduled actions.',
                ephemeral: true
            });
            return;
        }

        const pendingLocks = actions.filter(action => action.action === 'lock');
        const pendingUnlocks = actions.filter(action => action.action === 'unlock');

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
    } catch (error) {
        console.error('Error fetching scheduled actions:', error);
        await interaction.reply('Failed to fetch scheduled actions. Please try again later.');
    }
}

setInterval(async () => {
    const now = Date.now();
    try {
        const actions = await fetchData('scheduledActions', { epochTime: { $lte: now } });

        for (const action of actions) {
            const { action: type, postLink, _id } = action;
            const redditService = new RedditService();

            try {
                if (type === 'lock') {
                    await redditService.lockPost(postLink);
                    console.log(`Post locked successfully: ${postLink}`);
                } else if (type === 'unlock') {
                    await redditService.unlockPost(postLink);
                    console.log(`Post unlocked successfully: ${postLink}`);
                }

                await deleteData('scheduledActions', { _id });

                await interaction.channel.send({
                    embeds: [{
                        title: `Post ${type.charAt(0).toUpperCase() + type.slice(1)}ed`,
                        description: `The [post](${postLink}) has been successfully ${type}ed.`,
                        color: 0x00FF00
                    }]
                });
            } catch (error) {
                console.error(`Failed to ${type} post: ${postLink}`, error);
            }
        }
    } catch (error) {
        console.error('Error fetching scheduled actions:', error);
    }
}, 30000);