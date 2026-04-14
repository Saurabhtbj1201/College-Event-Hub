const generateGroupCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";

  for (let index = 0; index < 6; index += 1) {
    const randomIndex = Math.floor(Math.random() * alphabet.length);
    suffix += alphabet[randomIndex];
  }

  return `GRP-${suffix}`;
};

module.exports = generateGroupCode;
