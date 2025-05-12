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
} from '../commands/schedule/schedulePosts.mjs';
import {
  createPostCommands,
  handleCreatePosts,
  monitorUnlocks,
} from '../commands/create/createBulk.mjs';

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
      monitorUnlocks(this.client);
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
        } else if (interaction.commandName.startsWith('create')) {
          if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: 64 });
          }
          const result = await handleCreatePosts(interaction);

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
    DiscordService.instance = this;
  }

  async registerCommands(token) {
    const rest = new REST({ version: '10' }).setToken(token);
    try {
      console.log('[-] Registering commands...');
      const existingCommands = await rest.get(
        Routes.applicationCommands(this.client.user.id)
      );

      if (JSON.stringify(existingCommands) !== JSON.stringify(schedulePostCommands)) {
        await rest.put(
          Routes.applicationCommands(this.client.user.id),
            {
              body: 
              [
                ...schedulePostCommands,
                ...createPostCommands,
              ]
            }
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
}