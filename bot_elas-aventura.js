const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const client = new Client({
    authStrategy: new LocalAuth()
});
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});
client.on('ready', () => {
    console.log(' WhatsApp conectado com sucesso!');
});
client.initialize();
const reservas = {};
const destinos = {
    "1": { nome: "Rota dos Pireneus - Queijaria Coqueiral (11/01/25)", valores: { carro: 290, carona: 329, crianca: 99 } },
    "2": { nome: "Rota dos Pireneus - Calliandra Gastronomia (25/01/25)", valores: { carro: 300, carona: 350, crianca: 99 } },
    "3": { nome: "Expedição Terra Ronca (01 a 03/01/25)", valores: { carro: 2000, carona: 3200, crianca: 1500 } }
};
client.on('message', async (msg) => {
    const sender = msg.from;
    const message = msg.body.trim().toLowerCase();
    if (!reservas[sender]) reservas[sender] = { etapa: "inicio" };
    // Boas-vindas
    if (reservas[sender].etapa === "inicio" && /(oi|menu|reservar|ajuda)/i.test(message)) {
        reservas[sender].etapa = "solicitarNome";
        await client.sendMessage(sender, " Olá! Seja bem-vinda à *Elas Aventura*! \n\nPara começarmos, qual é o seu nome?");
        return;
    }

    // Coletar Nome e Exibir Destinos
    if (reservas[sender].etapa === "solicitarNome") {
        reservas[sender].nome = msg.body;
        reservas[sender].etapa = "escolherDestino";
        await client.sendMessage(sender, `Ótimo, ${reservas[sender].nome}! Escolha sua experiência:\n\n *Rota dos Pireneus - Queijaria Coqueiral (11/01/25)*\n *Rota dos Pireneus - Calliandra Gastronomia (25/01/25)*\n *Expedição Terra Ronca (01 a 03/01/25)*\n\nDigite o número correspondente à experiência escolhida para obter mais informações.`);
        return;

    }
    // Detalhes do Destino
    if (reservas[sender].etapa === "escolherDestino" && ["1", "2", "3"].includes(message)) {
        const destino = destinos[message];
        reservas[sender].destinoEscolhido = message;
        reservas[sender].destino = destino.nome;
        reservas[sender].valores = destino.valores;
        reservas[sender].etapa = "detalhesDestino";
        await client.sendMessage(sender, ` *${destino.nome}*\n\n *Valores:*\n Carro Próprio: R$ ${destino.valores.carro},00\n Carona Solidária: R$ ${destino.valores.carona},00\n Crianças: R$ ${destino.valores.crianca},00\n\nDigite *1* para prosseguir com a reserva ou *2* para escolher outro destino.`);
        return;
    }

    if (reservas[sender].etapa === "detalhesDestino") {
        if (message === "1") {
            reservas[sender].etapa = "escolherTransporte";
            await client.sendMessage(sender, "Ótima escolha! Agora, escolha o modo de transporte:\n\n Carro Próprio\n Carona");
        } else if (message === "2") {
            reservas[sender].etapa = "escolherDestino";
            await client.sendMessage(sender, `Escolha sua experiência:\n\n *Rota dos Pireneus - Queijaria Coqueiral (11/01/25)*\n *Rota dos Pireneus - Calliandra Gastronomia (25/01/25)*\n *Expedição Terra Ronca (01 a 03/01/25)*`);
        } else {
            await client.sendMessage(sender, "Por favor, digite *1* para prosseguir com a reserva ou *2* para escolher outro destino.");
        }
        return;
    }
    // Escolher Transporte (Ordem Invertida)
    if (reservas[sender].etapa === "escolherTransporte") {
        if (message === "1" || message.includes("carro")) {
            reservas[sender].transporte = "Carro Próprio";
        } else if (message === "2" || message.includes("carona")) {
            reservas[sender].transporte = "Carona";
        } else {
            await client.sendMessage(sender, "Escolha uma opção válida:\n\n Carro Próprio\n Carona");
            return;
        }
        reservas[sender].etapa = "quantidadePessoas";
        await client.sendMessage(sender, "Quantas pessoas vão participar da viagem?");
        return;
    }
    // Quantidade de Pessoas
    if (reservas[sender].etapa === "quantidadePessoas") {
        const qtd = parseInt(msg.body);
        if (!isNaN(qtd) && qtd > 0) {
            reservas[sender].qtdPessoas = qtd;
            reservas[sender].etapa = "quantidadeCriancas";
            await client.sendMessage(sender, "Há crianças no grupo? Se sim, informe a quantidade. Caso não houver, digite 0.");
        } else {
            await client.sendMessage(sender, "Por favor, informe um número válido de pessoas.");
        }
        return;
    }
    // Quantidade de Crianças
    if (reservas[sender].etapa === "quantidadeCriancas") {
        const qtdCriancas = parseInt(msg.body);
        reservas[sender].qtdCriancas = isNaN(qtdCriancas) ? 0 : qtdCriancas;
        reservas[sender].etapa = "revisaoReserva";
        const precoAdulto = reservas[sender].transporte === "Carona" ? reservas[sender].valores.carona : reservas[sender].valores.carro;
        reservas[sender].total = (reservas[sender].qtdPessoas - reservas[sender].qtdCriancas) * precoAdulto + reservas[sender].qtdCriancas * reservas[sender].valores.crianca;
        await client.sendMessage(sender, ` *Revisão da Reserva*\n\n Cliente: ${reservas[sender].nome}\n Destino: ${reservas[sender].destino}\n Transporte: ${reservas[sender].transporte}\n Pessoas: ${reservas[sender].qtdPessoas} (${reservas[sender].qtdCriancas} crianças)\n *Valor Total: R$ ${reservas[sender].total},00*\n\nDigite *CONFIRMAR* para finalizar a reserva ou *EDITAR* para corrigir algo.`);
        return;
    }
    // Confirmação da Reserva
    if (reservas[sender].etapa === "revisaoReserva") {
        if (message === "confirmar") {
            reservas[sender].etapa = "formaPagamento";
            await client.sendMessage(sender, " *Reserva confirmada!* Qual será a forma de pagamento?\n\n Pix\n Transferência Bancária\n Cartão");
        } else if (message === "editar") {
            reservas[sender].etapa = "escolherDestino";
            await client.sendMessage(sender, `Vamos editar sua reserva! Escolha novamente sua experiência:\n\n *Rota dos Pireneus - Queijaria Coqueiral (11/01/25)*\n *Rota dos Pireneus - Calliandra Gastronomia (25/01/25)*\n *Expedição Terra Ronca (01 a 03/01/25)*`);
        } else {
            await client.sendMessage(sender, "Por favor, digite *CONFIRMAR* para finalizar a reserva ou *EDITAR* para corrigir algo.");
        }
        return;
    }
    // Forma de Pagamento
    if (reservas[sender].etapa === "formaPagamento") {
        if (message === "1" || message.includes("pix")) {
            await client.sendMessage(sender, " *PIX*\nO pagamento pode ser feito via PIX utilizando a chave *elasaventura@gmail.com*. Assim que realizar a transferência, envie o comprovante aqui mesmo para confirmarmos sua reserva! ");
        } else if (message === "2" || message.includes("transferência")) {
            await client.sendMessage(sender, " *Transferência Bancária*\n\n Banco: Iti\n Beneficiária: Aretuza Alves Marcório\n Agência: 0500\n Conta Corrente: 022915470-8\n\nApós a transferência, basta enviar o comprovante aqui! ");
        } else if (message === "3" || message.includes("cartão")) {
            await client.sendMessage(sender, " *Cartão de Crédito*\nPara pagamentos no cartão, aguarde a geração do código de pagamento. Enviaremos as instruções em breve! ");
        } else {
            await client.sendMessage(sender, "Escolha uma opção válida:\n\n Pix\n Transferência Bancária\n Cartão");
            return;
        }
        reservas[sender].etapa = "finalizacao";
        await client.sendMessage(sender, "Muito obrigada por escolher a *Elas Aventura*! Estamos animadas para compartilhar essa experiência incrível com você!\n\nSe precisar de qualquer informação ou tiver alguma dúvida, é só chamar. Nos vemos em breve para viver essa aventura juntas! ");
        delete reservas[sender];
    }
});