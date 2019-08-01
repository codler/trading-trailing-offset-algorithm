declare var require: any;

interface Data {
  timestamp: string;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  trades: number;
  volume: number;
  vwap: number;
  lastSize: number;
  turnover: number;
  homeNotional: number;
  foreignNotional: number;
}

const formattedDayDate = date =>
  `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
const startTime = new Date("2019").getTime();

let data: Data[] = [];
for (let days = 0; days < 210; days++) {
  const date = new Date(startTime + days * 86400000);
  data = data.concat(require(`./data/${formattedDayDate(date)}.json`));
}

function run(stopLossTrigger: number, takeProfitTrigger: number) {
  let hasPosition = false;
  let highestPrice = 0;
  let lowestPrice = Infinity;
  let cashUSD = 0;
  let cashBTC = 0;
  let boughtPrice = 0;
  let profitCount = 0;
  let lossCount = 0;

  data.forEach(snapshot => {
    if (!hasPosition) {
      if (lowestPrice > snapshot.low) {
        lowestPrice = snapshot.low;
      }

      const triggerPrice = lowestPrice * takeProfitTrigger;

      if (triggerPrice <= snapshot.close) {
        // Buy
        boughtPrice = snapshot.close;
        cashBTC += 0.01;
        cashUSD -= boughtPrice * 0.01;
        hasPosition = true;
      }
    }

    if (hasPosition) {
      if (highestPrice < snapshot.high) {
        highestPrice = snapshot.high;
      }

      const triggerPrice = highestPrice * stopLossTrigger;
      if (triggerPrice >= snapshot.close) {
        // Sell
        if (boughtPrice > snapshot.close) {
          // Loss
          lossCount++;
        } else {
          // Profit
          profitCount++;
        }

        cashBTC -= 0.01;
        cashUSD += snapshot.close * 0.01;

        lowestPrice = snapshot.close;
        hasPosition = false;
        highestPrice = 0;
        boughtPrice = 0;
      }
    }
  });

  if (cashBTC !== 0) {
    cashBTC -= 0.01;
    cashUSD += data[data.length - 1].close * 0.01;
  }

  return {
    lossCount,
    profitCount,
    ratio: lossCount / profitCount,
    cashUSD,
    cashBTC
  };
}

const results = [];
for (
  let stopLossTrigger = 1 - 0.001;
  stopLossTrigger >= 0.95;
  stopLossTrigger = stopLossTrigger - 0.001
) {
  for (
    let takeProfitTrigger = 1 + 0.001;
    takeProfitTrigger <= 1.05;
    takeProfitTrigger = takeProfitTrigger + 0.001
  ) {
    const result = run(stopLossTrigger, takeProfitTrigger);
    results.push({
      stopLossTrigger,
      takeProfitTrigger,
      ...result
    });
  }
}
results.sort((a, b) => (b.cashUSD > a.cashUSD ? 1 : -1));

const limit = (result, index) => index < 20;
const noProfit = result => result.profitCount !== 0;
const moreProfitsThanLosses = result => result.lossCount <= result.profitCount;

const filtered = results
  .filter(noProfit)
  .filter(moreProfitsThanLosses)
  .filter(limit);
console.log(filtered);
