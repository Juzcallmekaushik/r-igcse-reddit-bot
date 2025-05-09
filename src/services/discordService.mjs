import dotenv from 'dotenv';
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  ActivityType
} from 'discord.js';

import {
  schedulePostCommands,
  handleSchedulePosts,
  startScheduledActionProcessor 
} from '../commands/scheduling/schedulePosts.mjs';

import { LogService } from '../services/logService.mjs';
import { RedditService } from '../services/redditService.mjs';
import fetchAndSendNewPostsImmediately from '../events/NewPost.mjs';


dotenv.config();

export class DiscordService {
  constructor(token, logChannelIds) {
    if (!Array.isArray(logChannelIds) || logChannelIds.length === 0) {
      throw new Error('DiscordService: logChannelIds must be a non-empty array of valid channel IDs.');
    }

    if (DiscordService.instance) {
      return DiscordService.instance;
    }

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.logService = new LogService(this.client, logChannelIds);
    this.redditService = new RedditService();

    this.client.once('ready', async () => {
      console.log(`[-] Logged in as ${this.client.user.tag}`);
      await this.registerCommands(token);
      this.client.user.setActivity('r/IGCSE Subreddit', {
        type: ActivityType.Watching,
      });
      startScheduledActionProcessor(this.client);
      await this.sendLoginEmbed(logChannelIds);
      fetchAndSendNewPostsImmediately().then(() => {
      });
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isCommand()) return;

      try {
        if (interaction.commandName.startsWith('schedule')) {
          if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: 64 });
          }
          const result = await handleSchedulePosts(interaction);

          await interaction.editReply({
            content: result,
          });
        }
      } catch (error) {
        await this.logService.logErrorToChannel(error, 'Interaction Handling', interaction);

        if (interaction.deferred) {
          await interaction.editReply({
            content: 'Failed to process the command. Please try again later.',
          });
        }

        if (interaction.channel) {
          await interaction.channel.send({
            content: `An error occurred while processing your command: ${error.message}`,
          });
        }
      }
    });

    this.client.login(token);
    DiscordService.instance = this; // Save the instance
  }

  async registerCommands(token) {
    const rest = new REST({ version: '10' }).setToken(token);
    try {
      console.log('[-] Registering commands...');
      const existingCommands = await rest.get(
        Routes.applicationCommands(this.client.user.id)
      );

      // Compare existing commands with the new ones
      if (JSON.stringify(existingCommands) !== JSON.stringify(schedulePostCommands)) {
        await rest.put(
          Routes.applicationCommands(this.client.user.id),
          { body: schedulePostCommands }
        );
        console.log('[-] Commands registered successfully.');
      } else {
        console.log('[-] Commands are already registered. Skipping registration.');
      }
    } catch (error) {
      console.error('⚠️ - Failed to register commands:', error.message);
    }
  }

  async sendLoginEmbed(logChannelIds) {
    try {
      const redditUser = await this.redditService.r.getMe();    
      const embed = {
        author: {
          name: this.client.user.tag,
          icon_url: this.client.user.displayAvatarURL(),
        },
        title: `Bot Restarted Successfully!`,
        description: `Logged in as Reddit user: [${redditUser.name}](https://www.reddit.com/u/${redditUser.name})\nLogged in as ${this.client.user.tag}`,
        color: 0x00ff00,
        timestamp: new Date().toISOString(),
      };

      for (const channelId of logChannelIds) {
        try {
          const channel = await this.client.channels.fetch(channelId);
          if (channel && channel.isTextBased()) {
            await channel.send({ embeds: [embed] });
          } else {
            console.error(`⚠️ Channel ${channelId} is not text-based or could not be fetched.`);
          }
        } catch (err) {
          console.error(`⚠️ Failed to send embed to channel ${channelId}:`, err.message);
        }
      }
    } catch (err) {
      console.error('⚠️ Failed to fetch Reddit user or send login embed:', err.message);
    }
  }

  async getPost(postLink) {
    try {
        const postIdMatch = postLink.match(/comments\/([a-z0-9]+)/i);
        if (!postIdMatch || postIdMatch.length < 2) {
            throw new Error('Invalid post link format. Could not extract post ID.');
        }

        const postId = postIdMatch[1];
        const post = await this.r.getSubmission(postId).fetch();

        if (post.subreddit.display_name.toLowerCase() !== 'igcse') {
            throw new Error(`The post belongs to the subreddit "${post.subreddit.display_name}", not "r/igcse".`);
        }

        return post;
    } catch (error) {
        await this.logService.logErrorToChannel('Error fetching post:', error);
        throw new Error('Failed to fetch post. Please ensure the link is valid and belongs to r/igcse.');
    }
  }

  async startAutoMod() {
    const subreddit = 'igcse';
    const discordChannelId = '1369535067592065034';

    const fetchAndSendNewPosts = async () => {
      try {
        const newPosts = await this.redditService.getNewPosts(subreddit);

        if (!newPosts || newPosts.length === 0) {
          console.log(`[AutoMod] No new posts found in r/${subreddit}.`);
          return;
        }

        for (const post of newPosts) {
          const message = `**${post.title}**\n${post.url}\nPosted by u/${post.author}`;
          const channel = await this.client.channels.fetch(discordChannelId);

          if (channel && channel.isTextBased()) {
            await channel.send(message);
            console.log(`[AutoMod] Sent post "${post.title}" to Discord channel ${discordChannelId}.`);
          } else {
            console.error(`[AutoMod] Failed to send post to channel ${discordChannelId}.`);
          }
        }
      } catch (error) {
        console.error(`[AutoMod] Error fetching or sending posts: ${error.message}`);
      }
    };

    // Run AutoMod every 5 minutes
    setInterval(fetchAndSendNewPosts, 5 * 60 * 1000);
  }
}