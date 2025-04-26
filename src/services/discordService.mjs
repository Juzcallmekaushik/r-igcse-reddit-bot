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
  handleSchedulePosts
} from '../commands/scheduling/schedulePosts.mjs';

dotenv.config();

export class DiscordService {
  constructor(token) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.client.once('ready', async () => {
      console.log(`[-] Logged in as ${this.client.user.tag}`);
      await this.client.application.fetch();

      const rest = new REST({ version: '10' }).setToken(token);
      const clientId = this.client.application.id;

      this.client.user.setActivity('r/IGCSE Subreddit', {
        type: ActivityType.Watching,
      });

      try {
        const existing = await rest.get(Routes.applicationCommands(clientId));

        const entryPointCommand = existing.find(cmd => cmd.name === 'entry-point');
        if (entryPointCommand) {
          schedulePostCommands.push({
            name: entryPointCommand.name,
            description: entryPointCommand.description,
            options: entryPointCommand.options,
          });
        }

        await rest.put(
          Routes.applicationCommands(clientId),
          { body: schedulePostCommands }
        );

        console.log('[-] Successfully reloaded application (/) commands.');
      } catch (error) {
        console.error('Error updating commands:', error);
      }
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isCommand()) return;

      if (interaction.commandName.startsWith('schedule')) {
        try {
          console.log(`[-] Received command: ${interaction.commandName}`);
          if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: 64 });
            console.log(`[-] Defering reply for command: ${interaction.commandName}`);
          }

          const result = await handleSchedulePosts(interaction);

          await interaction.editReply({
            content: result
          });
          console
        } catch (error) {
          console.error('Error handling interaction:', error);

          // Edit the deferred reply with an error message
          if (interaction.deferred) {
            await interaction.editReply({
              content: 'Failed to schedule the action. Please try again later.',
            });
          console.log(`[-] Edited reply for command: ${interaction.commandName}`);
          }
        }
      }
    });

    this.client.login(token);
  }
}
