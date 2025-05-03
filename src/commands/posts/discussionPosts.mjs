import { SlashCommandBuilder } from 'discord.js'
import { RedditService } from '../../services/redditService.mjs'
import { insertData } from '../../services/mongoService.mjs'
import { LogService } from '../../services/LogService.mjs'

export const discussionPostCommands = [
    new SlashCommandBuilder()
        .setName('create_discussion_post')
        .setDescription('Create a paper discussion post, lock it, and schedule its unlock')
        .addStringOption(opt =>
            opt.setName('paper')
                .setDescription('Qualification, syllabus name, and code')
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('unlocktime')
                .setDescription('Epoch timestamp (ms) when the post should be unlocked')
                .setRequired(true)
        )
        .addBooleanOption(opt =>
            opt.setName('lock')
                .setDescription('Whether to lock the post immediately (default: true)')
        )
].map(cmd => cmd.toJSON())

export async function handleDiscussionPosts(interaction) {
    const logService = new LogService(interaction.client, [
        '1365518941450932224',
        '1365561748341395577',
        '1365595878525636681',
        '1366048336506912768'
    ])
    const redditService = new RedditService()
    const hasModRole =
        interaction.member.roles.cache.has('576460179441188864') ||
        interaction.member.roles.cache.has('1364254995196674079') ||
        interaction.member.roles.cache.has('1238502135771955405') ||
        interaction.member.roles.cache.has('1366069579402575952') ||
        interaction.member.roles.cache.has('668919889247076392')
    if (!hasModRole) {
        return interaction.reply({ content: 'Not enough permissions.', flags: 64 })
    }

    await interaction.deferReply({ ephemeral: true })

    const paper = interaction.options.getString('paper')
    const unlockTimeStr = interaction.options.getString('unlocktime')
    const lockFlag = interaction.options.getBoolean('lock') ?? true

    let epochTime = parseInt(unlockTimeStr, 10)
    if (isNaN(epochTime)) {
        return interaction.editReply({ content: 'Invalid epoch timestamp.', flags: 64 })
    }
    if (epochTime < 1e12) epochTime *= 1000
    if (epochTime <= Date.now()) {
        return interaction.editReply({ content: 'Unlock time must be in the future.', flags: 64 })
    }

    try {
        const title = `${paper} Paper Discussion Thread`
        const body = `Paper Discussion Guidelines

This thread is dedicated only to the discussion of the ${paper} paper. Please adhere to the following rules:

- **Do not post** in this thread until it **has been unlocked by the moderators.** This will happen only after all exam sessions for this variant have concluded.

- **Do not create separate posts to discuss the exam.** Such posts will be removed and may lead to moderation actions.

- **Any discussion of leaked papers or exam content before all sessions are complete is strictly prohibited.**

- Requests for or sharing of locked papers, leaked material, or variant-specific questions (even as jokes) will result in a **permanent ban without warning.**

If you have any questions or need clarification, [please message the moderators.](https://www.reddit.com/message/compose?to=/r/IGCSE)

We appreciate your understanding and cooperation.

— The r/IGCSE Moderation Team`.trim()

        const submission = await redditService.createSelfPost({
            subredditName: 'igcse',
            title,
            text: body,
            flairId: '647215c6-202c-11f0-ba0a-565d319d9852'
        })
        if (lockFlag) await redditService.lockPost(submission)

        const postUrl = `https://reddit.com${submission.permalink}`

        await insertData('scheduledActions', {
            action: 'unlock',
            postLink: postUrl,
            epochTime,
            scheduledBy: interaction.user.username,
            guildid: interaction.guild.id,
            channelId: interaction.channel.id,
            moderator: interaction.user.username,
            createdAt: new Date()
        })

        const embed = {
            title: 'Discussion Post Scheduled',
            description: `[View Post](${postUrl})`,
            fields: [
                { name: 'Initially Locked', value: lockFlag ? 'Yes' : 'No' },
                { name: 'Unlock Time', value: `<t:${Math.floor(epochTime / 1000)}:F>` }
            ],
            color: 0x00FF00
        }

        await interaction.editReply({ embeds: [embed] })
    } catch (error) {
        await logService.logErrorToChannel(error, 'Create Discussion Post', interaction)
        await interaction.editReply({ content: 'Failed to create discussion post.', flags: 64 })
    }
}
