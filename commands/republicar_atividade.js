const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const { data } = require('../database');
const { postarAtividade } = require('../utils/postarAtividade');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('republicar_atividade')
    .setDescription('Escolha visualmente uma atividade salva para republicar com progresso e botões.'),

  async execute(interaction) {
    if (!data.atividades || data.atividades.length === 0) {
      await interaction.reply({ content: '❌ Nenhuma atividade salva.', ephemeral: true });
      return;
    }

    const options = data.atividades.map((a, idx) => ({
      label: a.nome.slice(0, 100),
      description: (a.descricao || 'Sem descrição').slice(0, 100),
      value: String(idx),
    }));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('selecionar_republicar')
        .setPlaceholder('Escolha uma atividade')
        .addOptions(options)
    );

    await interaction.reply({
      content: '📂 Selecione a atividade que deseja republicar:',
      components: [row],
      ephemeral: true,
    });
  },

async handleComponent(interaction) {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== 'selecionar_republicar') return;

  await interaction.deferReply({ ephemeral: true });

  const idx = parseInt(interaction.values[0]);
  const atividade = data.atividades[idx];
  if (!atividade) {
    await interaction.editReply({ content: '❌ Atividade inválida.', ephemeral: true });
    return;
  }

  await postarAtividade(interaction.channel, atividade, interaction.client);

  await interaction.editReply({
    content: `✅ Atividade "${atividade.nome}" republicada com sucesso!`,
    components: [],
  });
}
}