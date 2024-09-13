import React, { useState, useEffect } from "react";
import "./App.css";

const POSITIONS = ['SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'EP', 'LJ', 'HJ', 'CO', 'BTN'];
const STAGES = ['Preflop', 'Flop', 'Turn', 'River'];

function App() {
    const [players, setPlayers] = useState(Array(10).fill({ name: '', isDealer: false, position: '' }));
    const [gameStarted, setGameStarted] = useState(false);
    const [currentStage, setCurrentStage] = useState(STAGES[0]);
    const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
    const [handCount, setHandCount] = useState(1);
    const [lastBettor, setLastBettor] = useState(null);
    const [playerStats, setPlayerStats] = useState({});

    const handleNameChange = (index, name) => {
        const newPlayers = [...players];
        newPlayers[index] = { ...newPlayers[index], name };
        setPlayers(newPlayers);
    };

    const getPosition = (index, dealer) => {
        const playerCount = players.reduce((count, player) => {
            return player.name ? count + 1 : count;
        }, 0);
        if (index === dealer) return 'BTN';
        if (playerCount > 2) {
            if (index === (dealer + 1) % playerCount) return 'SB';
            if (index === (dealer + 2) % playerCount) return 'BB';
            if (index === (dealer + 3) % playerCount) return 'UTG';
            if (playerCount > 4) {
                if (index === (dealer - 1 + playerCount) % playerCount) return 'CO';
                if (index === (dealer - 2 + playerCount) % playerCount) return 'HJ';
                if (index === (dealer - 3 + playerCount) % playerCount) return 'LJ';
            }
        }
        return POSITIONS[(index - dealer - 1 + 10) % 10];
    }

    const handleDealerChange = (index) => {
        if (players.some(player => player.name)) {
            const newPlayers = players.map((player, i) => {
                return {
                    ...player,
                    isDealer: i === index,
                    position: getPosition(i, index),
                    fold: false,
                };
            });
            setPlayers(newPlayers);
        } else {
            alert('Please enter at least one player name to start the game.');
        }
    };

    const startGame = () => {
        if (players.some(player => player.name)) {
            setGameStarted(true);
            initializePlayerStats();
            setLastBettor(players.findIndex(player => player.position === 'BB'));
            setCurrentPlayerIndex(findFirstPlayerToAct(currentStage, players));
        } else {
            alert('Please enter at least one player name to start the game.');
        }
    };

    const initializePlayerStats = () => {
        const dealerIndex = players.findIndex(player => player.isDealer);
        const stats = {};
        players.forEach((player, i) => {
            if (player.name) {
                stats[i] = {
                    vpip: 0,
                    pfr: 0,
                    af: { bets: 0, calls: 0 },
                    rfi: 0,
                    betFold: 0,
                    handsPlayed: 0,
                    preflopActions: 0,
                    rfiOpportunities: 0,
                    betFoldOpportunities: 0,
                    position: player.position
                };
            }
        });
        setPlayerStats(stats);
    };

    const findFirstPlayerToAct = (propsStage, propsPlayers) => {
        console.log("FirstPlayerCheck", propsStage);
        if (propsStage === 'Preflop') {
            return propsPlayers.findIndex(player => player.position === "UTG");
        } else {
            let nextIndex = (propsPlayers.findIndex(player => player.isDealer) + 1) % propsPlayers.length;
            while (!propsPlayers[nextIndex].name || propsPlayers[nextIndex].fold === true) {
                nextIndex = (nextIndex + 1) % propsPlayers.length;
            }
            return nextIndex;
        }
    };

    const isLastPlayerToAct = (playerIndex) => {
        console.log("LastPlayerCheck", playerIndex, lastBettor);
        return lastBettor === playerIndex || (lastBettor === null && playerIndex === findFirstPlayerToAct(currentStage, players));
    };

    const handleAction = (action) => {
        console.log(players, currentStage);
        updatePlayerStats(currentPlayerIndex, action);
        if (action === 'Bet/Raise') {
            setLastBettor(currentPlayerIndex);
        } else if (action === 'Fold') {
            const newPlayers = players.map((player, i) => {
                if (i === currentPlayerIndex) return { ...player, fold: true };
                else return { ...player };
            });
            setPlayers(newPlayers);
            const restPlayers = newPlayers.reduce((count, player) => {
                return player.name && !player.fold ? count + 1 : count;
            }, 0);
            if (restPlayers == 1 || lastBettor === currentPlayerIndex || (lastBettor === null && currentPlayerIndex === findFirstPlayerToAct(currentStage, newPlayers))) {
                startNewHand();
                return;
            }
        }

        moveToNextPlayer(action === 'Fold');
    };

    const updatePlayerStats = (playerIndex, action) => {
        setPlayerStats(prevStats => {
            const playerStat = prevStats[playerIndex];
            if (!playerStat) return prevStats;

            const newStats = { ...playerStat };
            newStats.handsPlayed = handCount;

            if (currentStage === 'Preflop') {
                newStats.preflopActions++;
                if (action === 'Bet/Raise') {
                    newStats.pfr++;
                }
                if (action !== 'Fold') {
                    newStats.vpip++;
                }
                if (newStats.preflopActions === 1 && players[playerIndex].position !== 'SB' && players[playerIndex].position !== 'BB') {
                    newStats.rfiOpportunities++;
                    if (action === 'Bet/Raise') {
                        newStats.rfi++;
                    }
                }
            }

            if (action === 'Bet/Raise') {
                newStats.af.bets++;
            } else if (action === 'Call') {
                newStats.af.calls++;
            }

            if (action === 'Bet/Raise') {
                newStats.betFoldOpportunities++;
            } else if (action === 'Fold' && players[playerIndex].position !== 'SB' && players[playerIndex].position !== 'BB') {
                newStats.betFold++;
            }

            return { ...prevStats, [playerIndex]: newStats };
        });
    };

    const moveToNextPlayer = (folded = false) => {
        let nextIndex = (currentPlayerIndex + 1) % players.length;
        while (!players[nextIndex].name || players[nextIndex].fold === true) {
            nextIndex = (nextIndex + 1) % players.length;
        }

        console.log("MoveNextPlayer", currentPlayerIndex);
        if (currentStage === "Preflop" && players[lastBettor].position === "BB") {
            if (isLastPlayerToAct(currentPlayerIndex) && !folded) {
                moveToNextStage();
                return;
            }
        } else {
            if (isLastPlayerToAct(nextIndex) && !folded) {
                moveToNextStage();
                return;
            }
        }

        console.log("Passed", nextIndex);
        setCurrentPlayerIndex(nextIndex);
    };

    const moveToNextStage = () => {
        console.log("MoveNextStage");
        setLastBettor(null);

        const currentStageIndex = STAGES.indexOf(currentStage);
        if (currentStageIndex < STAGES.length - 1) {
            setCurrentStage(STAGES[currentStageIndex + 1]);
            setCurrentPlayerIndex(findFirstPlayerToAct(STAGES[currentStageIndex + 1], players));
        } else {
            startNewHand();
        }
    };

    const startNewHand = () => {
        setHandCount(prevCount => prevCount + 1);
        setCurrentStage(STAGES[0]);
        rotateDealerAndPositions();
        setLastBettor(players.findIndex(player => player.position === 'BB'));
    };

    const rotateDealerAndPositions = () => {
        const currentDealerIndex = players.findIndex(player => player.isDealer);
        let newDealerIndex = (currentDealerIndex + 1) % players.length;
        while (!players[newDealerIndex].name) {
            newDealerIndex = (newDealerIndex + 1) % players.length;
        }

        console.log("newDealerIndex", newDealerIndex);

        const newPlayers = players.map((player, i) => ({
            ...player,
            isDealer: i === newDealerIndex,
            position: getPosition(i, newDealerIndex),
            fold: false,
        }));
        setPlayers(newPlayers);
        setCurrentPlayerIndex(findFirstPlayerToAct(STAGES[0], newPlayers));
    };

    const calculateStats = (playerIndex) => {
        const stats = playerStats[playerIndex];
        if (!stats) return { vpip: 0, pfr: 0, af: 0, rfi: 0, betFold: 0 };

        const vpip = (stats.vpip / stats.handsPlayed * 100).toFixed(1);
        const pfr = (stats.pfr / stats.handsPlayed * 100).toFixed(1);
        const af = (stats.af.bets / (stats.af.calls || 1)).toFixed(2);
        const rfi = (stats.rfi / (stats.rfiOpportunities || 1) * 100).toFixed(1);
        const betFold = (stats.betFold / (stats.betFoldOpportunities || 1) * 100).toFixed(1);

        return { vpip, pfr, af, rfi, betFold };
    };

    const resetPlayerStats = () => {
        setPlayerStats(prevStats => {
            const newStats = { ...prevStats };
            newStats[currentPlayerIndex] = {
                vpip: 0,
                pfr: 0,
                af: { bets: 0, calls: 0 },
                rfi: 0,
                betFold: 0,
                handsPlayed: 0,
                preflopActions: 0,
                rfiOpportunities: 0,
                betFoldOpportunities: 0,
                position: players[currentPlayerIndex].position
            };
            return newStats;
        });
    };

    return (
        <div className="container">
            {!gameStarted ? (
                <div className="start-game-screen">
                    <h1>Poker Player Action Tracker</h1>
                    <h2>Start Game Screen</h2>
                    <div className="player-inputs">
                        {players.map((player, index) => (
                            <div key={index} className="player-input">
                                <input
                                    type="text"
                                    placeholder={`Player ${index + 1} Name`}
                                    value={player.name}
                                    onChange={(e) => handleNameChange(index, e.target.value)}
                                />
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={player.isDealer}
                                        onChange={() => handleDealerChange(index)}
                                    />
                                    Dealer
                                </label>
                            </div>
                        ))}
                    </div>
                    <button onClick={startGame} className="play-button">Play</button>
                </div>
            ) : (
                <div className="play-screen">
                    <h2>{currentStage}</h2>
                    <div className="player-action">
                        <button onClick={() => {
                            let newIndex = (currentPlayerIndex - 1 + players.length) % players.length;
                            while (!players[newIndex].name) {
                                newIndex = (newIndex - 1 + players.length) % players.length;
                            }
                            setCurrentPlayerIndex(newIndex);
                        }}>←</button>
                        <span>{players[currentPlayerIndex].position}</span>
                        <button onClick={() => {
                            let newIndex = (currentPlayerIndex + 1) % players.length;
                            while (!players[newIndex].name) {
                                newIndex = (newIndex + 1) % players.length;
                            }
                            setCurrentPlayerIndex(newIndex);
                        }}>→</button>
                    </div>
                    <h3>{players[currentPlayerIndex].name}</h3>
                    <button onClick={resetPlayerStats} className="reset-button">R</button>
                    <div className="action-buttons">
                        <button onClick={() => handleAction('Check')}>Check</button>
                        <button onClick={() => handleAction('Bet/Raise')}>Bet/Raise</button>
                        <button onClick={() => handleAction('Call')}>Call</button>
                        <button onClick={() => handleAction('Fold')}>Fold</button>
                    </div>
                    <div className="stats">
                        {Object.entries(calculateStats(currentPlayerIndex)).map(([stat, value]) => (
                            <p key={stat}>{stat.toUpperCase()}: {value}{stat === 'af' ? '' : '%'}</p>
                        ))}
                    </div>
                    <button onClick={startNewHand} className="next-hand-button">Next Hand</button>
                </div>
            )}
            <div className="footer">
                {/* <a href={import.meta.url.replace("esm.town", "val.town")} target="_blank" rel="noopener noreferrer">View Source</a> */}
            </div>
        </div>
    );
}

export default App;