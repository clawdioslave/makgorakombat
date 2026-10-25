/*
 * The version two players must share to fight online. Both machines run the fight themselves
 * and only the inputs cross, so the two engines must be the same tick for tick: raise this
 * whenever a change to src/engine (or to the messages in this folder) would make one build
 * play a different fight from the one before. Pages of different versions refuse each other
 * with a message saying so, rather than parting mid-fight on a DESYNC.
 */
export const VERSION = 1;
