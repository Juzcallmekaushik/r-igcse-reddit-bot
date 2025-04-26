import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { RedditService } from '../../services/redditService.mjs';
import { insertData, deleteData, fetchData } from '../../services/mongoService.mjs';
import { LogService } from '../../services/LogService.mjs'; // Import LogService

export const schedulePostCommands = [
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
    const logService = new LogService(interaction.client, ['1365518941450932224', '1365561748341395577', '1365595878525636681']); // Initialize LogService

    const hasModRole = interaction.member.roles.cache.has('576460179441188864') || 
                       interaction.member.roles.cache.has('1364254995196674079') ||
                       interaction.member.roles.cache.has('1238502135771955405') ||
                       interaction.member.roles.cache.has('668919889247076392');
    if (!hasModRole) {
        await interaction.editReply({
            content: 'Not enough permissions to execute this command.',
            flags: 64,
        });
        return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'list') {
        return handleListCommand(interaction, logService);
    }

    const postLink = interaction.options.getString('postlink');
    const time = interaction.options.getString('time');

    let epochTime = parseInt(time, 10);

    if (isNaN(epochTime)) {
        await logService.logErrorToChannel(new Error('Invalid epoch timestamp provided.'), 'Schedule Command', interaction);
        await interaction.editReply({
            content: 'Invalid epoch timestamp. Please provide a valid number.',
            flags: 64,
        });
        return;
    }

    if (epochTime < 1000000000000) {
        epochTime *= 1000;
    }

    if (epochTime <= Date.now()) {
        await interaction.editReply('Invalid epoch timestamp. Please provide a valid future timestamp.');
        return;
    }

    const action = subcommand === 'lock' ? 'lock' : 'unlock';

    try {
        const existingAction = await fetchData('scheduledActions', { postLink, guildid: interaction.guild.id });

        if (existingAction.length > 0) {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('overwrite_yes')
                        .setLabel('Yes')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('overwrite_no')
                        .setLabel('No')
                        .setStyle(ButtonStyle.Secondary)
                );

            await interaction.editReply({
                content: 'This post has already been scheduled. Would you like to overwrite it?',
                components: [row],
                flags: 64,
            });

            const filter = i => i.user.id === interaction.user.id;
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });

            collector.on('collect', async i => {
                if (i.customId === 'overwrite_yes') {
                    try {
                        await deleteData('scheduledActions', { postLink, guildid: interaction.guild.id });
                        await insertData('scheduledActions', {
                            action,
                            postLink,
                            epochTime,
                            scheduledBy: interaction.user.username,
                            guildid: interaction.guild.id,
                            createdAt: new Date()
                        });

                        await i.update({
                            content: `The [post](${postLink}) has been rescheduled to ${action} at <t:${Math.floor(epochTime / 1000)}:F>.`,
                            components: []
                        });
                    } catch (error) {
                        await logService.logErrorToChannel(error, 'Overwrite Scheduled Action', interaction);
                        await i.update({
                            content: 'Failed to overwrite the scheduled action. Please try again later.',
                            components: []
                        });
                    }
                } else if (i.customId === 'overwrite_no') {
                    await i.update({
                        content: 'The action was not overwritten.',
                        components: []
                    });
                }
            });

            return;
        }

        await insertData('scheduledActions', {
            action,
            postLink,
            epochTime,
            scheduledBy: interaction.user.username,
            guildid: interaction.guild.id,
            createdAt: new Date()
        });

        await interaction.editReply({
            content: `The [post](${postLink}) has been scheduled to ${action} at <t:${Math.floor(epochTime / 1000)}:F>.`,
            flags: 64,
        });

        await interaction.channel.send({
            embeds: [{
                title: `Post ${action.charAt(0).toUpperCase() + action.slice(1)} Scheduled`,
                description: `The [post](${postLink}) has been scheduled to be ${action}ed.`,
                fields: [
                    { name: 'Moderator', value: `Scheduled by: ${interaction.user.username}` },
                    { name: 'Scheduled Time', value: `<t:${Math.floor(epochTime / 1000)}:F> (<t:${Math.floor(epochTime / 1000)}:R>)` }
                ],
                color: 0x00FF00
            }],
        });
    } catch (error) {
        await logService.logErrorToChannel(error, 'Schedule Command', interaction);
        await interaction.editReply({
            content: 'Failed to schedule the action. Please try again later.',
            flags: 64,
        });
    }
}

async function handleListCommand(interaction, logService) {
    try {
        const now = Date.now();
        const actions = await fetchData('scheduledActions', { epochTime: { $gte: now }, guildid: interaction.guild.id });

        if (actions.length === 0) {
            await interaction.editReply({
                content: 'There are no pending scheduled actions.',
                flags: 64,
            });
            return;
        }

        const pendingLocks = actions.filter(action => action.action === 'lock');
        const pendingUnlocks = actions.filter(action => action.action === 'unlock');

        const lockEmbed = {
            title: 'Pending Locks',
            fields: pendingLocks.length > 0
                ? await Promise.all(pendingLocks.map(async action => {
                    const redditService = new RedditService();
                    const postTitle = await redditService.getPostTitle(action.postLink);
                    return {
                        name: `${pendingLocks.indexOf(action) + 1}. ${postTitle || 'Unknown Title'}`,
                        value: `Link: [here](${action.postLink})\nTime: <t:${Math.floor(action.epochTime / 1000)}:F> (<t:${Math.floor(action.epochTime / 1000)}:R>)`
                    };
                }))
                : [{ name: 'No pending locks', value: 'There are no pending locks.' }],
            color: 0xFFA500
        };

        const unlockEmbed = {
            title: 'Pending Unlocks',
            fields: pendingUnlocks.length > 0
                ? await Promise.all(pendingUnlocks.map(async action => {
                    const redditService = new RedditService();
                    const postTitle = await redditService.getPostTitle(action.postLink);
                    return {
                        name: `${pendingUnlocks.indexOf(action) + 1}. ${postTitle || 'Unknown Title'}`,
                        value: `Link: [here](${action.postLink})\nTime: <t:${Math.floor(action.epochTime / 1000)}:F> (<t:${Math.floor(action.epochTime / 1000)}:R>)`
                    };
                }))
                : [{ name: 'No pending unlocks', value: 'There are no pending unlocks.' }],
            color: 0x00FFFF
        };

        await interaction.editReply({
            embeds: [lockEmbed, unlockEmbed],
            flags: 64,
        });
    } catch (error) {
        await logService.logErrorToChannel(error, 'List Scheduled Actions', interaction);
        await interaction.editReply({
            content: 'Failed to fetch scheduled actions. Please try again later.',
            flags: 64,
        });
    }
}
