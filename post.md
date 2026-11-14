# Deixei de perguntar “será que ele publicou algo novo?” — e criei uma solução

Há um tempo, eu seguia pessoas que admiro, como o Erick Wendel. Um dia, pensei:

> “Tipo... nunca mais vi nada do Erick. Será que ele continua a programar? Será que publicou algum projeto novo? Kkk”

Essa pergunta fez-me perceber uma coisa: quando entrava no GitHub, eu não tinha uma forma simples de acompanhar o que as pessoas que sigo estavam a criar. Para descobrir se alguém tinha publicado um repositório novo, precisava de entrar no perfil de cada pessoa e verificar manualmente.

O RSS e o feed do GitHub não me pareciam oferecer a experiência que eu — e talvez outras pessoas — procurávamos. Então fui pesquisar e descobri que a API do GitHub disponibiliza dados que permitem acompanhar os repositórios públicos de outros utilizadores.

Foi assim que nasceu o **GitNotification**: um radar para acompanhar os projetos novos de quem sigo — ou, como costumo dizer, dos meus “ídolos” da programação. 😄

## Como funciona?

- Sincroniza as pessoas que sigo no GitHub;
- verifica periodicamente se publicaram repositórios novos nos últimos 30 dias;
- usa IA da Groq para analisar o README e gerar um resumo do projeto;
- envia notificações pelo Telegram ou pelo WhatsApp;
- permite fazer uma varredura manual ou ativar verificações automáticas a cada 15 minutos, enquanto o servidor estiver ligado.

Um detalhe importante: a aplicação não analisa todo o código do repositório. A análise da IA é baseada no README — por isso, quanto melhor a documentação do projeto, mais útil tende a ser o resumo.

Também criei uma configuração guiada, passo a passo, para tornar a experiência simples: configurar o perfil, indicar o utilizador do GitHub e escolher o canal de notificações.

Foi um projeto que começou com uma curiosidade pessoal e acabou por me desafiar a trabalhar com APIs, backend, interface web, integração com IA e notificações.

🚀 **Experimenta:** https://gitnotification.onrender.com  
💻 **Código-fonte:** https://github.com/nicolemos56/GitNotification

E tu? Também acompanhas manualmente os projetos de pessoas que admiras? Como resolves esse problema?

#GitHub #OpenSource #DesenvolvimentoWeb #InteligenciaArtificial #Groq #Programacao #SideProject
