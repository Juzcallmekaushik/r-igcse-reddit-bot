import { SlashCommandBuilder } from 'discord.js';
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
    new LogService(interaction.client, [
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
        const randomBatchNumber = Math.floor(Math.random() * 1000000);
        const BatchNumber = randomBatchNumber;
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

        // Filter out duplicates from jsonData
        const uniqueEntries = [];
        const seenEntriesForJson = new Set();

        for (const entry of jsonData) {
            const uniqueKey = `${entry.board}-${entry.subject_code}-${entry.paper_code}`;
            if (!seenEntriesForJson.has(uniqueKey)) {
                seenEntriesForJson.add(uniqueKey);
                uniqueEntries.push(entry);
            }
        }

        if (uniqueEntries.length < jsonData.length) {
            console.log(`Removed ${jsonData.length - uniqueEntries.length} duplicate entries.`);
        }

        for (const entry of uniqueEntries) {
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
                            batch_number: BatchNumber,
                            url: searchResult.url,
                            unlocktime: Number(unlocktime),
                            lock: lock,
                            guildId: interaction.guild.id,
                        };

                        await insertData('scheduledBulk', thread);

                        const todayDate = `${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`;
                        await insertData('bulkFetch', {
                            today_date: todayDate,
                            batch_number: BatchNumber,
                            unlocktime: unlocktime,
                            board,
                            subject_code,
                            paper_code,
                            url: searchResult.url,
                            guildId: interaction.guild.id,
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
        const fetchedBulkData = await fetchData('bulkFetch', { guildId: interaction.guild.id, batch_number: BatchNumber });
        const seenEntries = new Set();

        for (const record of fetchedBulkData) {
            const uniqueKey = `${record.board}-${record.subject_code}-${record.paper_code}`;
            if (seenEntries.has(uniqueKey)) {
                await deleteData('bulkFetch', { _id: record._id });
                console.log(`Removed duplicate entry: ${uniqueKey}`);
            } else {
                seenEntries.add(uniqueKey);
            }
        }
        if (posts.length > 0) {
            await interaction.editReply({
                content: `Scheduled ${posts.length} posts successfully!`,
            });
        } else {
            await interaction.editReply({
                content: 'No posts were scheduled.',
            });
        }
        const cleanedBulkData = await fetchData('bulkFetch', { guildId: interaction.guild.id, batch_number: BatchNumber });

        const groupedData = cleanedBulkData.reduce((acc, record) => {
            const key = `${record.board} ${record.subject_code}`;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(`[P${record.paper_code}](${record.url})`);
            return acc;
        }, {});

        const formattedMessage = `
**Greetings,**
---

**These are the ${new Date().toLocaleString('en-GB', { month: 'long', day: 'numeric' })} Discussion Threads:**

${Object.entries(groupedData)
    .map(
        ([subject, papers]) =>
        `**${subject}** – ${papers.join(', ')}`
    )
    .join('\n')}

---

**IMPORTANT NOTICE ⚠️**
---

- Firstly, [r/IGCSE](https://www.reddit.com/r/IGCSE/) does not tolerate any form of [malpractice](https://www.reddit.com/r/igcse/wiki/rules/), such as asking for or sharing examination material before its official release. This rule **includes jokes about sharing or asking for leaks**. Any users found to violate these rules will be banned from the subreddit without warning.

- Secondly, **paper discussion may only take place in posts with the "May/June 2025 Paper Discussion Thread".** These threads are created by the subreddit moderation team. **Do not make any posts pertaining to paper discussion yourself or comment on such posts.** If a post for your exam does not exist, please [message the moderators](https://www.reddit.com/message/compose?to=/r/igcse), and we will create one for you.

To find the discussion thread for your exam, click on the orange "May/June 2025 Paper Discussion" Flair under the title of this post. Doing so will show you all the discussion posts for the session. Alternatively, you can [click here](https://www.reddit.com/r/igcse/?f=flair_name%3A%22May%2FJune%202025%20Paper%20Discussion%22) to view all the discussion posts.

---

We appreciate your cooperation and wish you the best of luck for your exams.

— The [r/IGCSE](https://www.reddit.com/r/IGCSE/) Moderation Team
`;
        const embed = {
            title: `#${BatchNumber} Scheduled Posts (${cleanedBulkData.length})`,
            inline: false,
            fields: [
            ...Object.entries(groupedData).map(([subject, papers]) => ({
                name: subject,
                value: papers
                .map(paper => {
                    const record = cleanedBulkData.find(
                    r => `[P${r.paper_code}](${r.url})` === paper
                    );
                    return record
                    ? `[P${record.paper_code}](${record.url}) - ${record.unlocktime ? `<t:${record.unlocktime}:R>` : 'Not Locked'}`
                    : paper;
                })
                .join('\n'),
            })),
            ],
            color: 0xff6e4f
        };

        await interaction.editReply({
            content: `${cleanedBulkData.length} Posts created successfully!`,
        });
        await interaction.channel.send({
            embeds: [embed],
        });
        const chunks = formattedMessage.match(/[\s\S]{1,1960}/g) || [];
        for (const chunk of chunks) {
            await interaction.channel.send({
                content: `**Discussion pin post data - Please format it before posting**\n\`\`\`${chunk.trim().replace(/^\s+/gm, '')}\`\`\``,
            });
        }
        } else {
            console.error('Failed to create discussion threads post.');
            await interaction.channel.send({
            content: 'Failed to create discussion threads post. Please try again.',
            });
        }
    }

export function monitorUnlocks() {
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
