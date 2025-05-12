import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { RedditService } from '../../services/redditService.mjs';
import { insertData, deleteData, fetchData } from '../../services/mongoService.mjs';
import { LogService } from '../../services/logService.mjs';
import fetch from 'node-fetch';

export const createPostCommands = [
    new SlashCommandBuilder()
        .setName('create')
        .setDescription('Create and schedule posts')
        .addSubcommand(subcommand =>
            subcommand
                .setName('bulk')
                .setDescription('Upload the schedule file to create multiple exam threads')
                .addAttachmentOption(option =>
                    option
                        .setName('file')
                        .setDescription('File containing details for exam threads')
                        .setRequired(true)
                )
        )
].map(command => command.toJSON());

export async function handleCreatePosts(interaction) {
    const logService = new LogService(interaction.client, [
        '1365518941450932224',
        '1365561748341395577',
        '1365595878525636681',
        '1366048336506912768',
    ]);
    const redditService = new RedditService();

    const hasModRole =
        interaction.member.roles.cache.has('576460179441188864') ||
        interaction.member.roles.cache.has('1364254995196674079') ||
        interaction.member.roles.cache.has('1238502135771955405') ||
        interaction.member.roles.cache.has('1366069579402575952') ||
        interaction.member.roles.cache.has('668919889247076392');

    if (!hasModRole) {
        await interaction.editReply({
            content: 'Not enough permissions to execute this command.',
        });
        return;
    }

    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'bulk') {
        const file = interaction.options.getAttachment('file');
        if (!file) {
            await interaction.editReply({
                content: 'No file provided. Please upload a valid file.',
            });
            return;
        }

        let jsonData;
        const posts = [];

        try {
            const response = await fetch(file.url);
            if (!response.ok) {
                throw new Error('Failed to fetch the file content.');
            }
            const fileContent = await response.text();
            jsonData = JSON.parse(fileContent);
        } catch (error) {
            console.error(error);
            await interaction.editReply({
                content: 'Failed to process the file. Please ensure it is a valid JSON file.',
            });
            return;
        }

        for (const entry of jsonData) {
            const { board, subject, subject_code, paper_code, unlock_time, post_time, lock } = entry;

            const posttime = post_time === "now" ? Math.floor(Date.now() / 1000).toString() : post_time;
            const unlocktime = unlock_time;

            if (isNaN(posttime) || isNaN(unlocktime)) {
                await interaction.editReply({
                    content: 'Invalid timestamp provided. Please provide a valid epoch timestamp.',
                });
                return;
            }

            if (unlocktime < Math.floor(Date.now() / 1000)) {
                await interaction.editReply({
                    content: 'Invalid Unlock epoch timestamp. Please provide a valid future timestamp.',
                });
                return;
            }

            if (unlocktime < posttime) {
                await interaction.editReply({
                    content: 'Unlock time must be after the post time. Please provide valid timestamps.',
                });
                return;
            }

            const details = `${subject} (${subject_code}) P${paper_code}`;
            posts.push({
                board,
                details,
                unlocktime,
                posttime,
                lock
            });

            const post_matter = `
**Paper Discussion Guidelines:**
---
This thread is dedicated only to the discussion of the **${board} ${details}** paper. Please adhere to the following rules:

- **Do not post** in this thread until it **has been unlocked by the moderators.** This will happen only after all exam sessions for this variant have concluded.

- **Do not create separate posts to discuss the exam.** Such posts will be removed and may lead to moderation actions.

- **Any discussion of leaked papers or exam content before all sessions are complete is strictly prohibited.**

- Requests for or sharing of locked papers, leaked material, or variant-specific questions (even as jokes) will result in a **permanent ban without warning.**
---
If you have any questions or need clarification, [please message the moderators.](https://www.reddit.com/message/compose?to=/r/IGCSE)

We appreciate your understanding and cooperation.

— The r/IGCSE Moderation Team
`;
            const post = {
                title: `${board} ${details} Paper Discussion Thread`,
                body: post_matter,
                unlocktime: unlocktime,
                posttime: posttime,
                lock: lock
            };
            if (posttime === Math.floor(Date.now() / 1000).toString()) {
                if (!post.title || !post.body) {
                    await interaction.editReply({
                        content: 'Failed to create post. Post title or body is missing.',
                    });
                    return;
                }
                const createdPost = await redditService.submitSelfpost({
                    title: post.title,
                    body: post.body,
                    flairid: '647215c6-202c-11f0-ba0a-565d319d9852',
                });
                if (createdPost) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    const searchResult = await redditService.searchPostsById({
                        id: createdPost,
                    });

                    if (searchResult) {
                        if (lock) {
                            await redditService.lockPost(searchResult.url);
                        }

                        const thread = {
                            title: `${board} ${details} Paper Discussion Thread`,
                            url: searchResult.url,
                            unlocktime: Number(unlocktime),
                            lock: lock
                        };

                        await insertData('scheduledBulk', thread);

                        const todayDate = `${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`;
                        const indexNumber = `${new Date().toISOString().split('T')[0].replace(/-/g, '')}`; 

                        await insertData('bulkFetch', {
                            today_date: todayDate,
                            index_number: indexNumber,
                            board,
                            subject_code,
                            paper_code,
                            url: searchResult.url,
                        });
                    } else {
                        console.log('No matching post found.');
                    }
                } else {
                    console.error('Failed to create post.');
                    await interaction.editReply({
                        content: 'Failed to create post. Please try again.',
                    });
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        const fetchedBulkData = await fetchData('bulkFetch', { index_number: `${new Date().toISOString().split('T')[0].replace(/-/g, '')}` });
        const embed = {
            title: `${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} Scheduled Posts`,
            inline: false,
            fields: fetchedBulkData.map(record => ({
                name: `${record.subject_code} ${record.paper_code}`,
                value: `[here](${record.url})`,
            })),
        };

        await interaction.editReply({
            content: 'Posts created successfully!',
        });
        await interaction.channel.send({
            embeds: [embed],
        });
        } else {
            console.error('Failed to create discussion threads post.');
            await interaction.channel.send({
            content: 'Failed to create discussion threads post. Please try again.',
            });
        }
    }

export function monitorUnlocks(client) {
    const redditService = new RedditService();
    setInterval(async () => {
        try {
            const currentTime = Math.floor(Date.now() / 1000);

            const scheduledPosts = await fetchData('scheduledBulk', { unlocktime: { $lte: currentTime } });

            if (scheduledPosts.length > 0) {
                for (const post of scheduledPosts) {
                    await redditService.unlockPost(post.url);
                    await deleteData('scheduledBulk', { _id: post._id });
                }
            }
        } catch (error) {
            console.error('[MonitorUnlocks] Error while monitoring unlocks:', error);
        }
    }, 2000);
}
