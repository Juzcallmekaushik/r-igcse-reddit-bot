this.client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName.startsWith('schedule')) {
    try {
      await interaction.deferReply({ ephemeral: true });

      await handleSchedulePosts(interaction);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.followUp({
          content: 'Action completed successfully.',
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error('Error handling interaction:', error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.followUp({
          content: 'Failed to schedule the action. Please try again later.',
          ephemeral: true,
        });
      }
    }
  }
});
