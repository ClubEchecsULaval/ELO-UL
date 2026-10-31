const players = [
  { name: "Alice", elo: 1520 },
  { name: "Bob", elo: 1480 },
  { name: "Charlie", elo: 1410 }
];

const tbody = document.querySelector("#ranking-table");

players
  .sort((a, b) => b.elo - a.elo)
  .forEach((player, index) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${player.name}</td>
      <td>${player.elo}</td>
    `;

    tbody.appendChild(row);
  });