const generateFoodOrderNumber = () => {
  const randomDigits = Math.floor(100000 + Math.random() * 900000);
  return `FOOD-${randomDigits}`;
};

module.exports = generateFoodOrderNumber;
