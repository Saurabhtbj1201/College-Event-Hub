const generatePassId = () => {
  const stamp = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `PASS-${stamp}-${randomPart}`;
};

module.exports = generatePassId;
