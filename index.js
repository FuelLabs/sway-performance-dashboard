const main = async () => {
  const commits = await fetchCommits();

  const setNames = [
    // format 1
    'string',
    'storagemapvec',
    'storage_string',
    'nft',
    'merkle_proof',
    'fixed_point',

    // format 2 (includes size)
    'signed_integers',
    'reentrancy',
    'ownership',
  ];



  const setData = await Promise.all(setNames.map(async setName => {
    const data = await Promise.all(commits.map(async (commit) => {
      const perfData = await fetchPerformanceData(commit.sha, setName);
      perfData.commit = commit;
      perfData.date = new Date(commit.commit.author.date);
      return perfData;
    }));

    // ensure compatibility between data formats
    if (data[0] !== undefined && data[0].metrics !== undefined && data[0].elapsed === undefined) {
      data.forEach(p => {
        p.elapsed = p.metrics.reduce((acc, m) => acc + m.elapsed, 0);
      });
    }
    if (data[0] !== undefined && data[0].metrics === undefined && data[0].phases !== undefined) {
      data.forEach(p => {
        p.metrics = p.phases.metrics;
      });
    }
    if (data[0] !== undefined && data[0].phases !== undefined && data[0].phases.bytecode_size !== undefined) {
      data.forEach(p => {
        p.bytecode_size = p.phases.bytecode_size;
      });
    }

    console.log(setName, data);

    buildElapsedChart(document.getElementById(`${setName}_elapsed`), data, `Time elapsed over time (${setName}.json)`);
    buildMemoryUsageChart(document.getElementById(`${setName}_memory_usage`), data, `Memory usage per phase over time (${setName}.json)`);
    buildBytecodeSizeChart(document.getElementById(`${setName}_bytecode_size`), data, `Bytecode size over time (${setName}.json)`);
    return data;
  }));

  // build aggregate graphs

  const aggregatePerCommit = commits.reduce((acc, commit) => {
    acc[commit.sha] = {
      commit: commit,
      date: new Date(commit.commit.author.date),
      total_bytecode_size: 0,
      total_elapsed: 0,
      datapoint_count: 0,
    };
    return acc;
  }, {});

  setData.forEach(data => {
    data.forEach(d => {
      ++aggregatePerCommit[d.commit.sha].datapoint_count;
      aggregatePerCommit[d.commit.sha].total_bytecode_size += d.bytecode_size;
      aggregatePerCommit[d.commit.sha].total_elapsed += Number(d.elapsed); // this may be a string sometimes
    });
  });

  const aggData = Object.entries(aggregatePerCommit).map(([_, d]) => {
    d.bytecode_size = d.total_bytecode_size / d.datapoint_count; // build average
    d.elapsed = d.total_elapsed; // build total
    return d;
  });
  console.log('aggregate', aggData);

  buildElapsedChart(document.getElementById(`total_elapsed`), aggData, 'Total time elapsed over time');
  buildBytecodeSizeChart(document.getElementById(`average_bytecode_size`), aggData, 'Average bytecode size over time');
};

const fetchCommits = async () => {
  const res = await fetch('https://api.github.com/repos/FuelLabs/sway/commits?per_page=100');
  const commits = await res.json();
  return commits;
};

const fetchPerformanceData = async (commitHash, setName) => {
  const res = await fetch(`https://raw.githubusercontent.com/FuelLabs/sway-performance-data/master/${commitHash}/${setName}.json`);
  const data = await res.json();
  return data;
}

const buildElapsedChart = (ctx, perfData, title) => {
  const data = {
    datasets: [{
      label: "Time elapsed",
      data: perfData.map(p => ({
        x: p.date,
        y: p.elapsed,
        commit: p.commit,
      })),
      borderWidth: 1,
    }],
  };
  const min = perfData.reduce((acc, p) => p.date < acc ? p.date : acc, new Date());

  new Chart(ctx, {
    data,
    type: 'line',
    options: {
      plugins: {
        title: {
          display: true,
          text: title,
        },
        interaction: {
          intersect: true,
          mode: 'point',
        },
        tooltip: {
          callbacks: {
            footer: (tooltipItems) => {
              const dataIndex = tooltipItems[0].dataIndex;
              const commit = tooltipItems[0].dataset.data[dataIndex].commit;
              return `${commit.sha}\n${commit.commit.message.split('\n')[0]}`;
            },
          }
        },
      },
      responsive: true,
      scales: {
        x: {
          type: 'time',
          min,
        },
        y: {}
      }
    }
  });
}

const buildMemoryUsageChart = (ctx, perfData, title) => {
  const phases = [...perfData.reduce((acc, p) => {
    if (p.metrics !== undefined) {
      p.metrics.forEach(m => acc.add(m.phase));
    }
    return acc;
  }, new Set()).keys()];
  const data = {
    datasets: phases.map(phase => ({
      label: phase,
      data: perfData.map(p => ({
        x: p.date,
        y: p.metrics.find(m => m.phase === phase).memory_usage,
        commit: p.commit,
      })),
      borderWidth: 1,
    })),
  };
  const min = perfData.reduce((acc, p) => p.date < acc ? p.date : acc, new Date());

  new Chart(ctx, {
    data,
    type: 'line',
    options: {
      plugins: {
        title: {
          display: true,
          text: title,
        },
        tooltip: {
          callbacks: {
            footer: (tooltipItems) => {
              const dataIndex = tooltipItems[0].dataIndex;
              const commit = tooltipItems[0].dataset.data[dataIndex].commit;
              return `${commit.sha}\n${commit.commit.message.split('\n')[0]}`;
            },
          }
        },
      },
      responsive: true,
      scales: {
        x: {
          type: 'time',
          min,
        },
        y: {}
      }
    }
  });
}

const buildBytecodeSizeChart = (ctx, perfData, title) => {
  const data = {
    datasets: [{
      label: "Bytecode size",
      data: perfData.map(p => ({
        x: p.date,
        y: p.bytecode_size,
        commit: p.commit,
      })),
      borderWidth: 1,
    }],
  };
  const min = perfData.reduce((acc, p) => p.date < acc ? p.date : acc, new Date());

  new Chart(ctx, {
    data,
    type: 'line',
    options: {
      plugins: {
        title: {
          display: true,
          text: title,
        },
        tooltip: {
          callbacks: {
            footer: (tooltipItems) => {
              const dataIndex = tooltipItems[0].dataIndex;
              const commit = tooltipItems[0].dataset.data[dataIndex].commit;
              return `${commit.sha}\n${commit.commit.message.split('\n')[0]}`;
            },
          }
        },
      },
      responsive: true,
      scales: {
        x: {
          type: 'time',
          min,
        },
        y: {}
      }
    }
  });
}

main();
