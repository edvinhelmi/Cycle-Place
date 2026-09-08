const fs = require('fs');
const path = require('path');

const usersFile = path.join(__dirname, '../data/users.json');

fs.readFile(usersFile, 'utf8', (err, data) => {
    if (err) {
        console.error('Errore lettura users.json:', err);
        return;
    }
    
    let users = JSON.parse(data);
    let modifiedCount = 0;

    users = users.map(user => {
        if (user.refreshToken) {
            delete user.refreshToken; // Wipe the insecure plaintext token
            modifiedCount++;
        }
        return user;
    });

    fs.writeFile(usersFile, JSON.stringify(users, null, 2), 'utf8', (err) => {
        if (err) console.error('Errore salvataggio:', err);
        else console.log(`Migrazione GDPR completata. ${modifiedCount} token non sicuri rimossi. Tutti gli utenti dovranno effettuare un nuovo accesso.`);
    });
});

