const mode = 16749;
console.log('Mode:', mode);
console.log('Mode in octal:', mode.toString(8));
console.log('Is directory (0o040000 bit):', (mode & 0o040000) !== 0);
console.log('0o040000 =', 0o040000);
console.log('Mode & 0o040000 =', mode & 0o040000);