const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Enter admin email: ', (email) => {
  rl.question('Enter admin password: ', (password) => {
    rl.question('Enter admin name: ', (name) => {
      const hash = bcrypt.hashSync(password, 10);
      console.log('\nSQL Query to run:');
      console.log('-------------------');
      console.log(
        `INSERT INTO users (email, password, name, role) VALUES ('${email}', '${hash}', '${name}', 'admin');`
      );
      console.log('\nOr use this hash directly:');
      console.log(hash);
      rl.close();
    });
  });
});

