const fs = require('fs');
const path = require('path');
require('dotenv').config();

// index.js
const express = require('express');
const app = express();

// Isso serve apenas para manter o Render feliz
app.get('/', (req, res) => res.send('Bot está rodando!'));
app.listen(process.env.PORT || 3000, () => {
  console.log('Servidor web falso rodando');
});

const { Client, Collection, GatewayIntentBits, Events } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

client.commands = new Collection();

// Carregar comandos de /commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
  }
}

// Carregar interações (botões)
const buttonHandler = require('./interactions/buttons');

// Quando o bot estiver pronto
client.once(Events.ClientReady, () => {
  console.log(`🤖 Bot logado como ${client.user.tag}`);
});

// Tratamento de interações
client.on(Events.InteractionCreate, async interaction => {
  try {
    // Slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (command) return await command.execute(interaction);
    }

    // Modal da atividade
    if (interaction.isModalSubmit()) {
      const atividade = client.commands.get('atividade');
      if (atividade?.handleModal) return await atividade.handleModal(interaction);
    }

    // Botões (vão para buttons.js)
    if (interaction.isButton() && interaction.customId.startsWith('btn_')) {
      return await buttonHandler.execute(interaction);
    }

    // Select de republicar atividade
    if (interaction.isStringSelectMenu() && interaction.customId === 'selecionar_republicar') {
      const command = client.commands.get('republicar_atividade');
      if (command?.handleComponent) return await command.handleComponent(interaction);
    }

    // Select e botões de delete atividade
    if (
      interaction.customId.startsWith('select_atividade_para_deletar') ||
      interaction.customId.startsWith('confirm_delete_atividade_') ||
      interaction.customId.startsWith('delete_atividade_') ||
      interaction.customId.startsWith('cancel_delete') ||
      interaction.customId.startsWith('delete_meta_from_')
    ) {
      const command = client.commands.get('delete_atividade');
      if (command?.handleComponent) return await command.handleComponent(interaction);
    }

    // Interação não reconhecida
    if (!interaction.replied && !interaction.deferred) {
      return await interaction.reply({ content: '❌ Interação não reconhecida.', ephemeral: true });
    }

  } catch (err) {
    console.error('❌ Erro na interação:', err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Algo deu errado ao lidar com a interação.', ephemeral: true });
    }
  }
});

// Login
client.login(process.env.BOT_TOKEN);