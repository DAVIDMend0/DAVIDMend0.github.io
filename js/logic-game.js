/* ==========================================================================
   logic-game.js — Playground 03 · Logic Gates
   --------------------------------------------------------------------------
   Modes
     Classic  a 16-step tutorial: each step introduces a gate or a circuit
              (adders, MUX, comparator, flip-flops) with how it works and
              its Boolean equation. Only gates you've met so far are offered.
     Daily    5 puzzles a day, rising difficulty (same for everyone that day)
     Hard     3 puzzles a day with MUX / 3-input slots and bigger circuits
     Verilog  5 puzzles a day (3 normal + 2 hard); solve by clicking gates
              or by writing Verilog (assign / gate primitives)
   Rules
     Nothing is simulated before Submit; every Submit is an attempt.
     After a Submit, tap a truth-table row to watch the signals travel.
     A solved circuit lights up green. Levels unlock one at a time.
     No two puzzles repeat within a day, across all three daily modes.
   Share marks: 🟩 1 attempt · 🟧 2–5 · 🟥 6–10 · 🟪 11+ · ⬛ unsolved
   ========================================================================== */
(function () {
    'use strict';

    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const store = {
        get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
        set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    };
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const C = { bg: '#0d0d0f', ink: '#fafafa', muted: '#a1a1aa', faint: 'rgba(250,250,250,0.3)',
                red: '#e5372a', yellow: '#f5c518', green: '#22c55e', greenDim: 'rgba(34,197,94,0.38)' };
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------------------------------------------------------------
       Gate library
       eq: textbook notation (· AND, + OR, ⊕ XOR, ⊙ XNOR, ' NOT)
       v:  Verilog expression        atomic: result needs no parentheses
    --------------------------------------------------------------- */
    const GATES = {
        BUF:  { n: 1, f: a => a,            eq: a => a,                 v: a => a,                  atomic: true },
        NOT:  { n: 1, f: a => 1 - a,        eq: a => `${a}'`,           v: a => `~${a}`,            atomic: true },
        AND:  { n: 2, f: (a, b) => a & b,   eq: (a, b) => `${a} · ${b}`, v: (a, b) => `${a} & ${b}` },
        OR:   { n: 2, f: (a, b) => a | b,   eq: (a, b) => `${a} + ${b}`, v: (a, b) => `${a} | ${b}` },
        XOR:  { n: 2, f: (a, b) => a ^ b,   eq: (a, b) => `${a} ⊕ ${b}`, v: (a, b) => `${a} ^ ${b}` },
        NAND: { n: 2, f: (a, b) => 1 - (a & b), eq: (a, b) => `(${a} · ${b})'`, v: (a, b) => `~(${a} & ${b})`, atomic: true },
        NOR:  { n: 2, f: (a, b) => 1 - (a | b), eq: (a, b) => `(${a} + ${b})'`, v: (a, b) => `~(${a} | ${b})`, atomic: true },
        XNOR: { n: 2, f: (a, b) => 1 - (a ^ b), eq: (a, b) => `${a} ⊙ ${b}`,    v: (a, b) => `~(${a} ^ ${b})`, atomic: true },
        MUX:  { n: 3, f: (d0, d1, s) => (s ? d1 : d0), eq: (d0, d1, s) => `${s}'·${d0} + ${s}·${d1}`, v: (d0, d1, s) => `${s} ? ${d1} : ${d0}` },
        MAJ:  { n: 3, f: (a, b, c) => (a + b + c >= 2 ? 1 : 0), eq: (a, b, c) => `MAJ(${a}, ${b}, ${c})`,
                v: (a, b, c) => `(${a} & ${b}) | (${a} & ${c}) | (${b} & ${c})` },
        AND3: { n: 3, f: (a, b, c) => a & b & c, eq: (a, b, c) => `${a} · ${b} · ${c}`, v: (a, b, c) => `${a} & ${b} & ${c}` },
        OR3:  { n: 3, f: (a, b, c) => a | b | c, eq: (a, b, c) => `${a} + ${b} + ${c}`, v: (a, b, c) => `${a} | ${b} | ${c}` },
        XOR3: { n: 3, f: (a, b, c) => a ^ b ^ c, eq: (a, b, c) => `${a} ⊕ ${b} ⊕ ${c}`, v: (a, b, c) => `${a} ^ ${b} ^ ${c}` }
    };
    const PALETTE = { 1: ['NOT', 'BUF'], 2: ['AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR'], 3: ['MUX', 'MAJ', 'AND3', 'OR3', 'XOR3'] };
    const TWO = PALETTE[2];

    /* ---------------------------------------------------------------
       Classic: the tutorial. palette = gates offered at that step.
    --------------------------------------------------------------- */
    const AB = [['A', 0], ['B', 1]];
    const one = (palette, target, extra = {}) => Object.assign({
        inputs: AB, gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0.5 }],
        outputs: [{ name: 'Y', from: 'g1', row: 0.5 }], target: { Y: target }, palette
    }, extra);

    const LESSONS = [
        one(['AND'], i => i.A & i.B, {
            name: 'Both or nothing', kicker: 'Gate · AND',
            about: 'An AND gate outputs 1 only when every input is 1. Think of two switches in series: current reaches the output only if both are closed. Tap the gate to choose it, then submit.',
            eq: 'Y = A · B' }),
        one(['AND', 'OR'], i => i.A | i.B, {
            name: 'Either will do', kicker: 'Gate · OR',
            about: 'An OR gate outputs 1 when at least one input is 1: two switches in parallel, so either one completes the path.',
            eq: 'Y = A + B' }),
        { name: 'Flip it', kicker: 'Gate · NOT',
          about: 'A NOT gate (inverter) has one input and outputs the opposite. In CMOS it is a single transistor pair: a high input pulls the output low, and a low input pulls it high. A buffer (BUF) passes the signal through unchanged.',
          eq: "Y = A'", inputs: [['A', 0]], gates: [{ id: 'n1', in: ['A'], col: 1, row: 0 }],
          outputs: [{ name: 'Y', from: 'n1', row: 0 }], target: { Y: i => 1 - i.A }, palette: ['AND', 'OR', 'NOT', 'BUF'] },
        { name: 'Build a NAND', kicker: 'Gate · NAND',
          about: 'NAND is AND followed by NOT. It is the cheapest gate to make in CMOS (four transistors), and it is universal: every other gate can be built from NANDs alone.',
          eq: "Y = (A · B)'", inputs: AB,
          gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0.5 }, { id: 'n1', in: ['g1'], col: 2, row: 0.5 }],
          outputs: [{ name: 'Y', from: 'n1', row: 0.5 }], target: { Y: i => 1 - (i.A & i.B) }, palette: ['AND', 'OR', 'NOT', 'BUF'] },
        one(['AND', 'OR', 'NAND', 'NOR'], i => 1 - (i.A | i.B), {
            name: 'Neither one', kicker: 'Gate · NOR',
            about: 'NOR is OR followed by NOT, now packed into a single gate (and NAND joins your toolbox too). NOR is also universal. The Apollo Guidance Computer was built almost entirely from NOR gates.',
            eq: "Y = (A + B)'" }),
        one(['AND', 'OR', 'NAND', 'NOR', 'XOR'], i => i.A ^ i.B, {
            name: 'One or the other', kicker: 'Gate · XOR',
            about: 'Exclusive OR outputs 1 when the inputs are different. It is the “not equal” detector, and the heart of every adder.',
            eq: 'Y = A ⊕ B' }),
        one(TWO, i => 1 - (i.A ^ i.B), {
            name: 'Match maker', kicker: 'Gate · XNOR',
            about: 'XNOR is XOR followed by NOT: it outputs 1 when both inputs are equal. Comparators use one per bit to check that two numbers match.',
            eq: 'Y = A ⊙ B' }),
        { name: 'Half adder', kicker: 'Circuit · adder',
          about: 'Adds two bits. 1 + 1 = 10 in binary, so you need two outputs: the sum bit is 1 when exactly one input is 1, and the carry is 1 when both are.',
          eq: 'S = A ⊕ B     Cout = A · B', inputs: AB,
          gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0 }, { id: 'g2', in: ['A', 'B'], col: 1, row: 1 }],
          outputs: [{ name: 'S', from: 'g1', row: 0 }, { name: 'Cout', from: 'g2', row: 1 }],
          target: { S: i => i.A ^ i.B, Cout: i => i.A & i.B } },
        { name: 'Parity check', kicker: 'Circuit · parity',
          about: 'Chained XORs count ones: the output is 1 when an odd number of inputs are 1. Memory and serial links add a parity bit like this to catch a flipped bit.',
          eq: 'Y = A ⊕ B ⊕ C', inputs: [['A', 0], ['B', 1], ['C', 2]],
          gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0.5 }, { id: 'g2', in: ['g1', 'C'], col: 2, row: 1.25 }],
          outputs: [{ name: 'Y', from: 'g2', row: 1.25 }], target: { Y: i => i.A ^ i.B ^ i.C } },
        { name: 'Sum of products', kicker: 'Circuit · AND-OR',
          about: 'Most logic is written as a sum of products: AND gates build each condition, and an OR combines them. Here the alarm sounds if both sensors trip, or the override is on.',
          eq: 'Y = A · B + C', inputs: [['A', 0], ['B', 1], ['C', 2]],
          gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0.5 }, { id: 'g2', in: ['g1', 'C'], col: 2, row: 1.25 }],
          outputs: [{ name: 'Y', from: 'g2', row: 1.25 }], target: { Y: i => (i.A & i.B) | i.C } },
        { name: '2-to-1 multiplexer', kicker: 'Circuit · MUX',
          about: 'A multiplexer is a switch made of gates: the select line S picks which input reaches the output (S = 0 → A, S = 1 → B). CPUs use them everywhere to route data.',
          eq: "Y = S'·A + S·B", inputs: [['A', 0], ['B', 1], ['S', 2]],
          gates: [{ id: 'n1', in: ['S'], col: 1, row: 2.6 }, { id: 'g1', in: ['A', 'n1'], col: 2, row: 0.4 },
                  { id: 'g2', in: ['B', 'S'], col: 2, row: 1.6 }, { id: 'g3', in: ['g1', 'g2'], col: 3, row: 1 }],
          outputs: [{ name: 'Y', from: 'g3', row: 1 }], target: { Y: i => (i.S ? i.B : i.A) } },
        { name: '1-bit comparator', kicker: 'Circuit · comparator',
          about: 'Compares two bits: EQ is 1 when they match, GT when A is bigger (A = 1, B = 0). Wider comparators chain one of these per bit.',
          eq: "EQ = A ⊙ B     GT = A · B'", inputs: AB,
          gates: [{ id: 'n1', in: ['B'], col: 1, row: 1.5 }, { id: 'g1', in: ['A', 'B'], col: 2, row: 0 },
                  { id: 'g2', in: ['A', 'n1'], col: 2, row: 1.3 }],
          outputs: [{ name: 'EQ', from: 'g1', row: 0 }, { name: 'GT', from: 'g2', row: 1.3 }],
          target: { EQ: i => 1 - (i.A ^ i.B), GT: i => i.A & (1 - i.B) } },
        { name: 'Full adder', kicker: 'Circuit · adder',
          about: 'Two half adders and an OR: add A and B, then add the carry coming in from the bit before. Chain 32 of these and you have the adder inside a CPU.',
          eq: 'S = A ⊕ B ⊕ Cin     Cout = A·B + Cin·(A ⊕ B)', inputs: [['A', 0], ['B', 1], ['Cin', 2.4]],
          gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0.1 }, { id: 'g2', in: ['A', 'B'], col: 1, row: 1.3 },
                  { id: 'g3', in: ['g1', 'Cin'], col: 2, row: 0.5 }, { id: 'g4', in: ['g1', 'Cin'], col: 2, row: 1.9 },
                  { id: 'g5', in: ['g4', 'g2'], col: 3, row: 1.6 }],
          outputs: [{ name: 'S', from: 'g3', row: 0.5 }, { name: 'Cout', from: 'g5', row: 1.6 }],
          target: { S: i => i.A ^ i.B ^ i.Cin, Cout: i => (i.A & i.B) | (i.Cin & (i.A ^ i.B)) } },
        { name: 'T flip-flop', kicker: 'Sequential · T flip-flop',
          about: 'Flip-flops store one bit between clock ticks. The logic in front of the memory computes the next state Q⁺ from the current state Q. A T flip-flop toggles when T = 1, which makes it the building block of counters.',
          eq: 'Q⁺ = T ⊕ Q', inputs: [['T', 0], ['Q', 1]],
          gates: [{ id: 'g1', in: ['T', 'Q'], col: 1, row: 0.5 }],
          outputs: [{ name: 'Q⁺', from: 'g1', row: 0.5 }], target: { 'Q⁺': i => i.T ^ i.Q } },
        { name: 'D flip-flop with enable', kicker: 'Sequential · D flip-flop',
          about: 'A D flip-flop with enable keeps its value unless E = 1, then loads D on the next clock edge. Look closely: the logic in front is the same 2-to-1 MUX you built earlier.',
          eq: "Q⁺ = E·D + E'·Q", inputs: [['D', 0], ['Q', 1], ['E', 2]],
          gates: [{ id: 'n1', in: ['E'], col: 1, row: 2 }, { id: 'g1', in: ['D', 'E'], col: 2, row: 0.4 },
                  { id: 'g2', in: ['Q', 'n1'], col: 2, row: 1.6 }, { id: 'g3', in: ['g1', 'g2'], col: 3, row: 1 }],
          outputs: [{ name: 'Q⁺', from: 'g3', row: 1 }], target: { 'Q⁺': i => (i.E ? i.D : i.Q) } },
        { name: 'JK flip-flop', kicker: 'Sequential · JK flip-flop',
          about: 'J sets, K resets, nothing holds, and J = K = 1 toggles. It is the most flexible flip-flop, and its next-state logic is a classic exam question.',
          eq: "Q⁺ = J·Q' + K'·Q", inputs: [['J', 0], ['K', 1], ['Q', 2]],
          gates: [{ id: 'n2', in: ['K'], col: 1, row: 1.05 }, { id: 'n1', in: ['Q'], col: 1, row: 2.7 },
                  { id: 'g1', in: ['J', 'n1'], col: 2, row: 0.3 }, { id: 'g2', in: ['n2', 'Q'], col: 2, row: 1.7 },
                  { id: 'g3', in: ['g1', 'g2'], col: 3, row: 1 }],
          outputs: [{ name: 'Q⁺', from: 'g3', row: 1 }], target: { 'Q⁺': i => (i.J & (1 - i.Q)) | ((1 - i.K) & i.Q) } }
    ];

    /* ---------------------------------------------------------------
       Daily puzzle templates. A hidden random solution is generated for
       each, so every puzzle is solvable; any matching answer is accepted.
       Tiers 1–4 = normal, h1–h3 = hard (3-input and NOT slots).
    --------------------------------------------------------------- */
    const ABC = [['A', 0], ['B', 1], ['C', 2]];
    const TEMPLATES = [
        { id: 't1', tier: 1, inputs: AB, gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0.5 }],
          outputs: [{ name: 'Y', from: 'g1', row: 0.5 }] },
        { id: 't2a', tier: 2, inputs: AB, gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0 }, { id: 'g2', in: ['A', 'B'], col: 1, row: 1 }],
          outputs: [{ name: 'Y', from: 'g1', row: 0 }, { name: 'Z', from: 'g2', row: 1 }] },
        { id: 't2b', tier: 2, inputs: ABC, gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0.5 }, { id: 'g2', in: ['g1', 'C'], col: 2, row: 1.25 }],
          outputs: [{ name: 'Y', from: 'g2', row: 1.25 }] },
        { id: 't3a', tier: 3, inputs: ABC, gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0.4 }, { id: 'g2', in: ['B', 'C'], col: 1, row: 1.7 },
                  { id: 'g3', in: ['g1', 'g2'], col: 2, row: 1.05 }],
          outputs: [{ name: 'Y', from: 'g3', row: 1.05 }] },
        { id: 't3b', tier: 3, inputs: ABC, gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0.5 }, { id: 'g2', in: ['g1', 'C'], col: 2, row: 0.3 },
                  { id: 'g3', in: ['g1', 'C'], col: 2, row: 1.7 }],
          outputs: [{ name: 'Y', from: 'g2', row: 0.3 }, { name: 'Z', from: 'g3', row: 1.7 }] },
        { id: 't3c', tier: 3, inputs: ABC, gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0.3 }, { id: 'g2', in: ['A', 'C'], col: 1, row: 1.6 },
                  { id: 'g3', in: ['g1', 'g2'], col: 2, row: 0.95 }],
          outputs: [{ name: 'Y', from: 'g3', row: 0.95 }] },
        { id: 't4a', tier: 4, inputs: ABC, gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0.3 }, { id: 'g2', in: ['B', 'C'], col: 1, row: 1.8 },
                  { id: 'g3', in: ['g1', 'C'], col: 2, row: 0.7 }, { id: 'g4', in: ['g3', 'g2'], col: 3, row: 1.25 }],
          outputs: [{ name: 'Y', from: 'g4', row: 1.25 }] },
        { id: 't4b', tier: 4, inputs: ABC, gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0.3 }, { id: 'g2', in: ['A', 'C'], col: 1, row: 1.7 },
                  { id: 'g3', in: ['g1', 'g2'], col: 2, row: 0.6 }, { id: 'g4', in: ['g2', 'B'], col: 2, row: 1.9 }],
          outputs: [{ name: 'Y', from: 'g3', row: 0.6 }, { name: 'Z', from: 'g4', row: 1.9 }] },

        { id: 'h1a', tier: 'h1', inputs: [['A', 0], ['B', 1], ['S', 2]],
          gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0.2 }, { id: 'g2', in: ['A', 'B'], col: 1, row: 1.3 },
                  { id: 'm1', in: ['g1', 'g2', 'S'], col: 2, row: 1 }],
          outputs: [{ name: 'Y', from: 'm1', row: 1 }] },
        { id: 'h1b', tier: 'h1', inputs: ABC,
          gates: [{ id: 'n1', in: ['A'], col: 1, row: 0 }, { id: 'g1', in: ['n1', 'B'], col: 2, row: 0.3 },
                  { id: 'g2', in: ['B', 'C'], col: 2, row: 1.9 }, { id: 'm1', in: ['g1', 'g2', 'A'], col: 3, row: 1 }],
          outputs: [{ name: 'Y', from: 'm1', row: 1 }] },
        { id: 'h2a', tier: 'h2', inputs: ABC,
          gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0.55 }, { id: 'g2', in: ['B', 'C'], col: 1, row: 1.5 },
                  { id: 'm1', in: ['g1', 'g2', 'C'], col: 2, row: 0.6 }, { id: 'g3', in: ['g1', 'g2'], col: 2, row: 1.9 },
                  { id: 'g4', in: ['m1', 'A'], col: 3, row: 0.6 }],
          outputs: [{ name: 'Y', from: 'g4', row: 0.6 }, { name: 'Z', from: 'g3', row: 1.9 }] },
        { id: 'h2b', tier: 'h2', inputs: ABC,
          gates: [{ id: 'g1', in: ['A', 'C'], col: 1, row: 0.4 }, { id: 'n1', in: ['B'], col: 1, row: 1.6 },
                  { id: 'm1', in: ['A', 'n1', 'C'], col: 2, row: 1.5 }, { id: 'g2', in: ['g1', 'B'], col: 2, row: 0.2 },
                  { id: 'g3', in: ['g2', 'm1'], col: 3, row: 0.9 }],
          outputs: [{ name: 'Y', from: 'g3', row: 0.9 }] },
        { id: 'h3a', tier: 'h3', inputs: [['A', 0], ['B', 1], ['C', 2], ['D', 3]],
          gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0.4 }, { id: 'g2', in: ['C', 'D'], col: 1, row: 2.6 },
                  { id: 'g3', in: ['g1', 'C'], col: 2, row: 0.6 }, { id: 'g4', in: ['g1', 'g2'], col: 2, row: 2.8 },
                  { id: 'm1', in: ['g3', 'g2', 'A'], col: 3, row: 1.2 }],
          outputs: [{ name: 'Y', from: 'm1', row: 1.2 }, { name: 'Z', from: 'g4', row: 2.8 }] },
        { id: 'h3b', tier: 'h3', inputs: [['A', 0], ['B', 1], ['C', 2], ['D', 3]],
          gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0.5 }, { id: 'n1', in: ['C'], col: 1, row: 2 },
                  { id: 'g2', in: ['n1', 'D'], col: 2, row: 2.4 }, { id: 'm1', in: ['g1', 'B', 'D'], col: 2, row: 0.9 },
                  { id: 'g3', in: ['m1', 'g2'], col: 3, row: 1.5 }],
          outputs: [{ name: 'Y', from: 'g3', row: 1.5 }] }
    ];

    const MODES = {
        classic: { label: 'Classic' },
        daily:   { label: 'Daily', slots: [
            { name: 'Warm-up', tiers: [1] }, { name: 'Two at once', tiers: [2] }, { name: 'Chain reaction', tiers: [2, 3] },
            { name: 'Junction', tiers: [3] }, { name: 'Boss level', tiers: [4] }] },
        hard:    { label: 'Hard', slots: [
            { name: 'Selector', tiers: ['h1'] }, { name: 'Datapath', tiers: ['h2'] }, { name: 'Boss level', tiers: ['h3'] }] },
        verilog: { label: 'Verilog', slots: [
            { name: 'Warm-up', tiers: [2] }, { name: 'Junction', tiers: [3] }, { name: 'Chain reaction', tiers: [4] },
            { name: 'Selector', tiers: ['h1', 'h2'] }, { name: 'Boss level', tiers: ['h3'] }] }
    };
    const DAILY_MODES = ['daily', 'hard', 'verilog'];
    const DAILY_EPOCH = Date.UTC(2026, 10, 1);   // Daily #1 = 1 Nov 2026

    /* ---------------- date + seeded randomness ---------------- */
    function seededRandom(seed) {   // mulberry32
        return function () {
            seed = (seed + 0x6D2B79F5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    function hashString(s) {
        let h = 2166136261;
        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
    }
    const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    function dailyNumber(key) {
        const [y, m, d] = key.split('-').map(Number);
        return Math.round((Date.UTC(y, m - 1, d) - DAILY_EPOCH) / 86400000) + 1;
    }

    /* ---------------- circuit evaluation ---------------- */
    function evalCircuit(lv, types, vec) {
        const val = Object.assign({}, vec);
        lv.gates.forEach(g => {
            const args = g.in.map(s => val[s]);
            const t = types[g.id];
            val[g.id] = (t && args.every(a => a != null)) ? GATES[t].f(...args) : null;
        });
        const out = {};
        lv.outputs.forEach(o => { out[o.name] = val[o.from]; });
        return { val, out };
    }
    function allVectors(names) {
        const n = names.length, out = [];
        for (let r = 0; r < (1 << n); r++) {
            const v = {};
            names.forEach((name, k) => { v[name] = (r >> (n - 1 - k)) & 1; });
            out.push(v);
        }
        return out;
    }
    const tablesOf = (tpl, sol) => {
        const vecs = allVectors(tpl.inputs.map(i => i[0]));
        return tpl.outputs.map(o => vecs.map(v => evalCircuit(tpl, sol, v).out[o.name]).join(''));
    };

    // Reject boring puzzles: constant outputs, outputs that copy or invert one
    // input, duplicate outputs, or inputs that never affect anything.
    function isInteresting(tpl, sol, tables) {
        const names = tpl.inputs.map(i => i[0]);
        const vecs = allVectors(names);
        for (const t of tables) {
            if (/^0+$|^1+$/.test(t)) return false;
            for (const n of names) {
                if (t === vecs.map(v => v[n]).join('') || t === vecs.map(v => 1 - v[n]).join('')) return false;
            }
        }
        if (new Set(tables).size !== tables.length) return false;
        return names.every(n => vecs.some(v => {
            const flipped = Object.assign({}, v, { [n]: 1 - v[n] });
            const a = evalCircuit(tpl, sol, v).out, b = evalCircuit(tpl, sol, flipped).out;
            return tpl.outputs.some(o => a[o.name] !== b[o.name]);
        }));
    }

    function randomType(rand, arity) {
        if (arity === 1) return rand() < 0.85 ? 'NOT' : 'BUF';
        if (arity === 3) return rand() < 0.5 ? 'MUX' : PALETTE[3][1 + Math.floor(rand() * 4)];
        return TWO[Math.floor(rand() * TWO.length)];
    }

    // All of a day's puzzles are generated together so none repeats
    // (same truth tables) across Daily, Hard and Verilog.
    const dayCache = {};
    function makeDay(key) {
        if (dayCache[key]) return dayCache[key];
        const rand = seededRandom(hashString('logic-day-v2-' + key));
        const used = new Set();
        const day = {};
        DAILY_MODES.forEach(mode => {
            day[mode] = MODES[mode].slots.map(slot => {
                for (let tries = 0; tries < 800; tries++) {
                    const tier = slot.tiers[Math.floor(rand() * slot.tiers.length)];
                    const pool = TEMPLATES.filter(t => t.tier === tier);
                    const tpl = pool[Math.floor(rand() * pool.length)];
                    const sol = {};
                    tpl.gates.forEach(g => { sol[g.id] = randomType(rand, g.in.length); });
                    const tables = tablesOf(tpl, sol);
                    const sig = tpl.inputs.length + ':' + tables.join('|');
                    if (used.has(sig) || !isInteresting(tpl, sol, tables)) continue;
                    used.add(sig);
                    const target = {};
                    tpl.outputs.forEach(o => { target[o.name] = v => evalCircuit(tpl, sol, v).out[o.name]; });
                    return { name: slot.name, hard: String(tier).startsWith('h'), inputs: tpl.inputs, gates: tpl.gates, outputs: tpl.outputs, target };
                }
                return null;   // never expected; filtered below
            }).filter(Boolean);
        });
        dayCache[key] = day;
        return day;
    }

    /* ---------------- equations + Verilog from a circuit ---------------- */
    function exprOf(lv, types, id, kind) {
        const g = lv.gates.find(x => x.id === id);
        if (!g) return { s: id, atomic: true };
        const t = types[g.id];
        if (!t) return { s: kind === 'v' ? g.id : '?', atomic: true };
        const args = g.in.map(src => { const e = exprOf(lv, types, src, kind); return e.atomic ? e.s : `(${e.s})`; });
        return { s: GATES[t][kind](...args), atomic: !!GATES[t].atomic };
    }
    const equationLines = (lv, types) => lv.outputs.map(o => `${o.name} = ${exprOf(lv, types, o.from, 'eq').s}`);

    function verilogHeader(lv, title) {
        const ins = lv.inputs.map(i => i[0]).join(', ');
        const outs = lv.outputs.map(o => o.name).join(', ');
        return `module ${title} (\n    input  ${ins},\n    output ${outs}\n);\n`;
    }
    function verilogFromGates(lv, types, title) {
        const wires = lv.gates.map(g => g.id);
        const lines = lv.gates.map(g => {
            const t = types[g.id];
            if (!t) return `    assign ${g.id} = 1'b0;   // choose this gate`;
            return `    assign ${g.id} = ${GATES[t].v(...g.in)};`;
        });
        const pad = Math.max(...lv.outputs.map(o => o.name.length), ...wires.map(w => w.length));
        const outs = lv.outputs.map(o => `    assign ${o.name.padEnd(pad)} = ${o.from};`);
        return `${verilogHeader(lv, title)}    wire ${wires.join(', ')};\n\n${lines.join('\n')}\n${outs.join('\n')}\nendmodule\n`;
    }
    function verilogStarter(lv, title, note) {
        return `// ${note}\n// Make every output match the truth table. Supported:\n//   assign with  &  |  ^  ~  ?:   and gate primitives\n//   and, or, xor, nand, nor, xnor, not, buf\n${verilogHeader(lv, title)}\n${lv.outputs.map(o => `    assign ${o.name} = 1'b0;   // your logic here`).join('\n')}\n\nendmodule\n`;
    }

    /* ---------------------------------------------------------------
       A small Verilog subset: module/port/wire declarations, assign
       statements, and gate primitives. Combinational and 1-bit only.
    --------------------------------------------------------------- */
    function verr(msg, line) { const e = new Error(msg); e.line = line; return e; }

    function tokenize(src) {
        const toks = [], re = /\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/|(\d+'[bBdDhHoO][0-9a-fA-FxXzZ_]+|\d+)|([A-Za-z_][A-Za-z0-9_$]*)|(~\^|\^~|&&|\|\||[~!&|^?:(),;=@*])/y;
        let i = 0, line = 1;
        while (i < src.length) {
            re.lastIndex = i;
            const m = re.exec(src);
            if (!m) throw verr(`Unexpected character '${src[i]}'`, line);
            if (m[1]) toks.push({ t: 'num', v: m[1], line });
            else if (m[2]) toks.push({ t: 'id', v: m[2], line });
            else if (m[3]) toks.push({ t: 'op', v: m[3], line });
            line += (m[0].match(/\n/g) || []).length;
            i = re.lastIndex;
        }
        return toks;
    }

    function numValue(tok) {
        const m = /^(\d+)'([bBdDhHoO])(.+)$/.exec(tok.v);
        if (!m) return Number(tok.v) & 1;
        if (/[xXzZ]/.test(m[3])) throw verr(`${tok.v}: x and z values aren't supported here`, tok.line);
        const base = { b: 2, o: 8, d: 10, h: 16 }[m[2].toLowerCase()];
        return parseInt(m[3].replace(/_/g, ''), base) & 1;
    }

    const PRIMS = { and: 'AND', or: 'OR', xor: 'XOR', nand: 'NAND', nor: 'NOR', xnor: 'XNOR', not: 'NOT', buf: 'BUF' };

    function compileVerilog(src, inputNames, outputNames) {
        const toks = tokenize(src);
        let p = 0;
        const last = () => toks[Math.max(0, p - 1)] || { line: 1 };
        const peek = () => toks[p];
        const next = () => toks[p++];
        const expect = v => {
            const t = next();
            if (!t || t.v !== v) throw verr(`Expected '${v}'${t ? ` but found '${t.v}'` : ' before the end of the code'}`, (t || last()).line);
            return t;
        };

        function primary() {
            const t = next();
            if (!t) throw verr('An expression ended too early', last().line);
            if (t.v === '(') { const e = ternary(); expect(')'); return e; }
            if (t.v === '~' || t.v === '!') return { op: 'not', a: primary() };
            if (t.t === 'num') return { op: 'const', v: numValue(t) };
            if (t.t === 'id') return { op: 'id', name: t.v, line: t.line };
            throw verr(`Unexpected '${t.v}' in an expression`, t.line);
        }
        const bin = (sub, ops) => () => {
            let l = sub();
            while (peek() && ops.includes(peek().v)) { const o = next().v; l = { op: o, a: l, b: sub() }; }
            return l;
        };
        // Verilog precedence: & > ^ ~^ > | > && > || > ?:
        const andE = bin(primary, ['&']), xorE = bin(andE, ['^', '~^', '^~']), orE = bin(xorE, ['|']);
        const landE = bin(orE, ['&&']), lorE = bin(landE, ['||']);
        function ternary() {
            const c = lorE();
            if (peek() && peek().v === '?') { next(); const a = ternary(); expect(':'); const b = ternary(); return { op: '?', c, a, b }; }
            return c;
        }
        function skipStatement() {
            let depth = 0;
            while (p < toks.length) {
                const t = next();
                if (t.v === '(') depth++;
                else if (t.v === ')') depth--;
                else if (t.v === ';' && depth <= 0) return;
            }
        }

        const assigns = [];
        while (p < toks.length) {
            const t = next();
            if (t.v === ';') continue;
            if (t.t !== 'id') throw verr(`Unexpected '${t.v}'`, t.line);
            const kw = t.v;
            if (kw === 'module' || ['input', 'output', 'inout', 'wire', 'logic'].includes(kw)) { skipStatement(); continue; }
            if (kw === 'endmodule') continue;
            if (kw === 'assign') {
                do {
                    const id = next();
                    if (!id || id.t !== 'id') throw verr('Expected a signal name after assign', (id || t).line);
                    expect('=');
                    assigns.push({ target: id.v, expr: ternary(), line: id.line });
                } while (peek() && peek().v === ',' && next());
                expect(';');
                continue;
            }
            if (PRIMS[kw]) {
                const type = PRIMS[kw];
                if (peek() && peek().t === 'id') next();   // optional instance name
                expect('(');
                const args = [ternary()];
                while (peek() && peek().v === ',') { next(); args.push(ternary()); }
                expect(')');
                expect(';');
                if (args[0].op !== 'id') throw verr(`The first terminal of ${kw} must be its output signal`, t.line);
                const ins = args.slice(1), unary = type === 'NOT' || type === 'BUF';
                if (unary ? ins.length !== 1 : ins.length < 2) throw verr(`${kw} needs ${unary ? 'exactly one input' : 'at least two inputs'}`, t.line);
                assigns.push({ target: args[0].name, expr: { op: 'prim', type, args: ins }, line: t.line });
                continue;
            }
            if (['always', 'initial', 'reg'].includes(kw)) throw verr(`'${kw}' isn't supported here. Use assign or gate primitives (combinational logic only).`, t.line);
            throw verr(`Unknown statement '${kw}'. Start lines with assign or a gate primitive like and(...)`, t.line);
        }

        const seen = {};
        assigns.forEach(a => {
            if (inputNames.includes(a.target)) throw verr(`${a.target} is an input, so it can't be assigned`, a.line);
            if (seen[a.target]) throw verr(`${a.target} is assigned twice (lines ${seen[a.target]} and ${a.line})`, a.line);
            seen[a.target] = a.line;
        });
        const missingOut = outputNames.find(o => !seen[o]);
        if (missingOut) throw verr(`Output ${missingOut} is never assigned`, last().line);

        function ev(e, env) {
            switch (e.op) {
                case 'const': return e.v;
                case 'id':
                    if (!(e.name in env)) throw { missing: e.name, line: e.line };
                    return env[e.name];
                case 'not': return 1 - ev(e.a, env);
                case '&': return ev(e.a, env) & ev(e.b, env);
                case '|': return ev(e.a, env) | ev(e.b, env);
                case '^': return ev(e.a, env) ^ ev(e.b, env);
                case '~^': case '^~': return 1 - (ev(e.a, env) ^ ev(e.b, env));
                case '&&': return (ev(e.a, env) && ev(e.b, env)) ? 1 : 0;
                case '||': return (ev(e.a, env) || ev(e.b, env)) ? 1 : 0;
                case '?': return ev(e.c, env) ? ev(e.a, env) : ev(e.b, env);
                case 'prim': {
                    const v = e.args.map(a => ev(a, env));
                    const and = v.reduce((x, y) => x & y), or = v.reduce((x, y) => x | y), xor = v.reduce((x, y) => x ^ y);
                    return { AND: and, OR: or, XOR: xor, NAND: 1 - and, NOR: 1 - or, XNOR: 1 - xor, NOT: 1 - v[0], BUF: v[0] }[e.type];
                }
            }
            return 0;
        }
        function run(vec) {
            const env = Object.assign({}, vec);
            let pending = assigns.slice(), lastMissing = null;
            while (pending.length) {
                const rest = [];
                pending.forEach(a => {
                    try { env[a.target] = ev(a.expr, env); }
                    catch (m) { if (m && m.missing) { lastMissing = m; rest.push(a); } else throw m; }
                });
                if (rest.length === pending.length) {
                    if (!seen[lastMissing.missing] && !inputNames.includes(lastMissing.missing)) {
                        throw verr(`Unknown signal '${lastMissing.missing}'`, lastMissing.line);
                    }
                    throw verr(`Combinational loop: ${rest.map(a => a.target).join(', ')} depend on each other`, rest[0].line);
                }
                pending = rest;
            }
            return env;
        }
        run(Object.fromEntries(inputNames.map(n => [n, 0])));   // surface errors right away
        return { run, signals: assigns.map(a => a.target) };
    }

    /* ---------------------------------------------------------------
       The game
    --------------------------------------------------------------- */
    function initLogic() {
        const host = $('#logicCircuit');
        if (!host) return;
        const NS = 'http://www.w3.org/2000/svg';

        let mode = 'classic', levels = LESSONS, idx = 0;
        let types = {}, revealed = false, attempts = 0, live = {}, countdown = null;
        let method = 'gates', compiled = null, codeError = null;
        let todayKey = dateKey(new Date());

        // ---- persistence ----
        // logicClassic2: { solved: { i: {types, attempts} } }
        // logicDay2: { key, daily|hard|verilog: { solved: { i: {method, types, code, attempts} }, drafts } }
        const loadDay = () => {
            const d = store.get('logicDay2');
            return d && d.key === todayKey ? d : { key: todayKey };
        };
        let progress;
        function loadProgress() {
            if (mode === 'classic') progress = store.get('logicClassic2') || { solved: {} };
            else {
                const d = loadDay();
                progress = d[mode] || { solved: {}, drafts: {} };
                progress.drafts = progress.drafts || {};
            }
        }
        function save() {
            if (mode === 'classic') return store.set('logicClassic2', progress);
            const d = loadDay();
            d[mode] = progress;
            store.set('logicDay2', d);
        }
        const yesterday = () => { const y = new Date(); y.setDate(y.getDate() - 1); return dateKey(y); };
        const streak = () => {
            const s = store.get('logicStreak');
            return s && (s.last === todayKey || s.last === yesterday()) ? s.count : 0;
        };
        function bumpStreak() {
            const s = store.get('logicStreak') || { last: null, count: 0 };
            if (s.last === todayKey) return;
            s.count = s.last === yesterday() ? s.count + 1 : 1;
            s.last = todayKey;
            store.set('logicStreak', s);
        }

        const lv = () => levels[idx];
        const inputNames = () => lv().inputs.map(i => i[0]);
        const outputNames = () => lv().outputs.map(o => o.name);
        const isSolved = i => !!progress.solved[i];
        const unlockedUpTo = () => { let i = 0; while (i < levels.length - 1 && isSolved(i)) i++; return i; };
        const usingCode = () => mode === 'verilog' && method === 'code';
        const allSet = () => usingCode() || lv().gates.every(g => types[g.id]);
        const paletteFor = g => {
            const own = lv().palette;
            const base = PALETTE[g.in.length];
            return own ? base.filter(t => own.includes(t)) : base;
        };
        const moduleName = () => `puzzle${idx + 1}`;
        const codeText = () => $('#logicCodeInput').value;

        function results() {
            const outs = outputNames();
            return allVectors(inputNames()).map(r => {
                let got;
                if (usingCode()) {
                    const env = compiled ? compiled.run(r) : {};
                    got = Object.fromEntries(outs.map(o => [o, env[o] == null ? null : env[o]]));
                } else got = evalCircuit(lv(), types, r).out;
                return { r, got, ok: outs.every(o => got[o] === lv().target[o](r)) };
            });
        }

        function setMode(m) {
            mode = m;
            todayKey = dateKey(new Date());
            $$('[data-logic-mode]').forEach(b => {
                const on = b.dataset.logicMode === m;
                b.classList.toggle('active', on);
                b.setAttribute('aria-pressed', String(on));
            });
            levels = m === 'classic' ? LESSONS : makeDay(todayKey)[m];
            loadProgress();
            open(unlockedUpTo());
        }

        function open(i) {
            idx = clamp(i, 0, unlockedUpTo());
            const done = progress.solved[idx];
            types = done && done.types ? Object.assign({}, done.types) : {};
            attempts = done ? done.attempts : 0;
            revealed = !!done;
            compiled = null;
            codeError = null;
            if (mode === 'verilog') {
                method = done ? done.method : (progress.drafts[idx] != null ? 'code' : method);
                const code = done && done.code ? done.code
                    : progress.drafts[idx] != null ? progress.drafts[idx]
                    : verilogStarter(lv(), moduleName(), `Daily #${dailyNumber(todayKey)} · Puzzle ${idx + 1} (${lv().name})`);
                $('#logicCodeInput').value = code;
                if (done && done.method === 'code') { try { compiled = compileVerilog(code, inputNames(), outputNames()); } catch (e) { compiled = null; } }
            }
            live = {};
            inputNames().forEach(n => { live[n] = 0; });
            if (done) { const r = results(); live = Object.assign({}, r[r.length - 1].r); }
            render();
        }

        function submit() {
            if (!allSet() || revealed) return;
            if (usingCode()) {
                try {
                    compiled = compileVerilog(codeText(), inputNames(), outputNames());
                    codeError = null;
                } catch (e) {
                    compiled = null;
                    codeError = e;
                    render();
                    return;   // a compile error doesn't cost an attempt
                }
            }
            attempts++;
            revealed = true;
            const res = results();
            const firstWrong = res.find(x => !x.ok);
            live = Object.assign({}, (firstWrong || res[res.length - 1]).r);
            if (!firstWrong) {
                progress.solved[idx] = { method: usingCode() ? 'code' : 'gates', types: usingCode() ? null : Object.assign({}, types),
                                         code: mode === 'verilog' ? codeText() : null, attempts };
                save();
                if (mode !== 'classic' && levels.every((_, i) => isSolved(i))) bumpStreak();
            }
            render();
        }

        /* ---------------- drawing ---------------- */
        function svgEl(tag, attrs, parent) {
            const el = document.createElementNS(NS, tag);
            Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
            if (parent) parent.appendChild(el);
            return el;
        }

        // Signal depth: how many gates a signal has passed through (sets the animation delay)
        function depths(L) {
            const d = {};
            L.inputs.forEach(([n]) => { d[n] = 0; });
            L.gates.forEach(g => { d[g.id] = 1 + Math.max(...g.in.map(s => d[s] || 0)); });
            return d;
        }
        // Every gate that feeds a given node (its "cone of influence")
        function ancestors(L, id, acc = new Set()) {
            const g = L.gates.find(x => x.id === id);
            if (!g || acc.has(id)) return acc;
            acc.add(id);
            g.in.forEach(s => ancestors(L, s, acc));
            return acc;
        }

        function renderCircuit(res) {
            const L = lv(), solved = isSolved(idx), code = usingCode();
            const drawTypes = code ? {} : types;
            const state = evalCircuit(L, drawTypes, live);
            const liveRes = res.find(x => inputNames().every(n => x.r[n] === live[n]));
            // a wrong circuit can still get some rows right: those trace in yellow
            const partial = revealed && !solved && !!liveRes && liveRes.ok;
            const outVal = name => (code ? (liveRes ? liveRes.got[name] : null) : state.out[name]);
            const depth = depths(L);
            const STEP = 0.32;   // seconds per gate level

            const colW = 118, rowH = 62, padX = 14, padY = 16;
            const maxCol = Math.max(...L.gates.map(g => g.col)) + 1;
            const maxRow = Math.max(...L.inputs.map(i => i[1]), ...L.gates.map(g => g.row), ...L.outputs.map(o => o.row));
            const W = padX * 2 + maxCol * colW + 72, Hh = padY * 2 + (maxRow + 1) * rowH;
            const cy = row => padY + row * rowH + rowH / 2;
            const pos = {};
            L.inputs.forEach(([n, r]) => { pos[n] = { x: padX, y: cy(r), w: 46, h: 30, kind: 'in' }; });
            L.gates.forEach(g => {
                const n = g.in.length;
                pos[g.id] = { x: padX + g.col * colW, y: cy(g.row), w: n === 1 ? 54 : 72, h: n === 3 ? 56 : n === 1 ? 34 : 44, kind: 'gate', g };
            });
            L.outputs.forEach(o => { pos['out:' + o.name] = { x: padX + maxCol * colW, y: cy(o.row), w: 64, h: 30, kind: 'out' }; });

            // wrong outputs for this row, and the gates that could be to blame
            const wrongOuts = revealed && !solved ? L.outputs.filter(o => outVal(o.name) !== L.target[o.name](live)) : [];
            const suspects = new Set();
            if (!code) wrongOuts.forEach(o => ancestors(L, o.from, suspects));

            const svg = svgEl('svg', { viewBox: `0 0 ${W} ${Hh}`, class: 'logic-svg' + (solved ? ' solved' : ''), role: 'img', 'aria-label': 'Circuit diagram',
                style: `max-width:${Math.round(W * 1.25)}px;min-width:${Math.round(W * 0.8)}px` });
            const wires = svgEl('g', {}, svg);
            const portY = (p, k, n) => p.y + (n === 1 ? 0 : n === 2 ? (k ? 11 : -11) : (k - 1) * 16);

            // Route each wire as H-V-H. Try a few places for the vertical leg and
            // keep the first that doesn't run through another box.
            const boxes = Object.entries(pos).map(([id, b]) => ({ id, x0: b.x - 4, x1: b.x + b.w + 4, y0: b.y - b.h / 2 - 3, y1: b.y + b.h / 2 + 3 }));
            const hits = (from, to, x1, mx, x2, y1, y2) => boxes.filter(b => b.id !== from && b.id !== to && (
                (y1 > b.y0 && y1 < b.y1 && Math.min(x1, mx) < b.x1 && Math.max(x1, mx) > b.x0) ||
                (y2 > b.y0 && y2 < b.y1 && Math.min(mx, x2) < b.x1 && Math.max(mx, x2) > b.x0) ||
                (mx > b.x0 && mx < b.x1 && Math.min(y1, y2) < b.y1 && Math.max(y1, y2) > b.y0))).length;
            const wire = (from, x2, y2, v, k, delayFrom, to) => {
                const p = pos[from];
                const x1 = p.x + p.w, y1 = p.y;
                const options = [x1 + (x2 - x1) * (0.45 + 0.1 * k), x2 - 16 - 8 * k, x1 + 14 + 8 * k];
                let mx = options[0], best = Infinity;
                for (const m of options) {
                    const n = hits(from, to, x1, m, x2, y1, y2);
                    if (n < best) { best = n; mx = m; }
                    if (!n) break;
                }
                const d = `M${x1} ${y1} H${mx} V${y2} H${x2}`;
                svgEl('path', { d, class: 'w-base' }, wires);
                if (!revealed || (v == null && !solved)) return;
                const cls = 'w-sig ' + (solved ? (v ? 'ok-on' : 'ok-off') : partial ? (v ? 'part-on' : 'part-off') : (v ? 'on' : 'off'));
                svgEl('path', { d, class: cls, pathLength: 1, style: `--d:${(depth[delayFrom] * STEP).toFixed(2)}s` }, wires);
            };
            L.gates.forEach(g => {
                const p = pos[g.id];
                g.in.forEach((src, k) => wire(src, p.x, portY(p, k, g.in.length), state.val[src], k, src, g.id));
            });
            L.outputs.forEach((o, k) => {
                const p = pos['out:' + o.name];
                const v = code ? (pos[o.from].kind === 'in' ? state.val[o.from] : null) : state.val[o.from];
                wire(o.from, p.x, p.y, v, k, o.from, 'out:' + o.name);
            });

            const maxDepth = Math.max(0, ...Object.values(depth));
            Object.entries(pos).forEach(([id, p]) => {
                const cls = ['logic-node', p.kind];
                if (p.kind === 'in' && revealed) cls.push('live');
                if (p.kind === 'gate' && (solved || code)) cls.push('locked');
                if (p.kind === 'gate' && suspects.has(id)) cls.push('suspect');
                const g = svgEl('g', { class: cls.join(' '), transform: `translate(${p.x} ${p.y - p.h / 2})` }, svg);

                if (p.kind === 'in') {
                    const v = live[id], on = revealed && v === 1;
                    if (revealed) {
                        g.setAttribute('role', 'button');
                        g.setAttribute('tabindex', '0');
                        g.setAttribute('aria-label', `Input ${id} is ${v}. Toggle to trace the circuit.`);
                        g.dataset.input = id;
                    }
                    svgEl('rect', { width: p.w, height: p.h, rx: 3, class: 'box' + (on ? (solved ? ' ok-on' : partial ? ' part-on' : ' on') : '') }, g);
                    svgEl('text', { x: p.w / 2, y: p.h / 2 + 4, 'text-anchor': 'middle', class: 'lbl' }, g).textContent = revealed ? `${id}=${v}` : id;
                } else if (p.kind === 'gate') {
                    const type = drawTypes[id];
                    const n = p.g.in.length;
                    if (!solved && !code) {
                        g.setAttribute('role', 'button');
                        g.setAttribute('tabindex', '0');
                        g.setAttribute('aria-label', `Gate ${type || 'not set'}. Activate to change it.`);
                        g.dataset.gate = id;
                    }
                    svgEl('rect', { width: p.w, height: p.h, rx: 4, class: 'box gate-box' + (type || code ? '' : ' unset') + (solved ? ' ok' : ''),
                        style: solved ? `--d:${(depth[id] * STEP).toFixed(2)}s` : '' }, g);
                    const label = code ? (solved ? '✓' : '·') : (type || '?');
                    svgEl('text', { x: p.w / 2, y: p.h / 2 + 5, 'text-anchor': 'middle', class: 'gate-label' + (type || code ? '' : ' unset') }, g).textContent = label;
                    if (type === 'MUX') {   // port labels: data 0, data 1, select
                        ['0', '1', 's'].forEach((t, k) => svgEl('text', { x: 6, y: p.h / 2 + (k - 1) * 16 + 3, class: 'port-lbl' }, g).textContent = t);
                    }
                    // the gate's value for this row appears as the signal arrives
                    const v = state.val[id];
                    if (revealed && v != null && !code) {
                        const b = svgEl('g', { class: 'v-badge' + (v ? ' on' : '') + (solved ? ' ok' : partial ? ' part' : ''), style: `--d:${(depth[id] * STEP + 0.22).toFixed(2)}s`,
                            transform: `translate(${p.w + 2} ${p.h / 2 - 17})` }, g);
                        svgEl('rect', { width: 14, height: 14, rx: 2 }, b);
                        svgEl('text', { x: 7, y: 10.5, 'text-anchor': 'middle' }, b).textContent = v;
                    }
                    if (n === 3 && !type && !code) svgEl('text', { x: p.w / 2, y: p.h - 6, 'text-anchor': 'middle', class: 'port-lbl' }, g).textContent = '3-in';
                } else {
                    const name = id.slice(4), v = outVal(name), want = L.target[name](live);
                    const bad = revealed && !solved && v !== want;
                    svgEl('rect', { width: p.w, height: p.h, rx: 3,
                        class: 'box out-box' + (!revealed ? ' idle' : solved ? ' ok' : bad ? ' bad' : ' good'),
                        style: `--d:${((maxDepth + 1) * STEP).toFixed(2)}s` }, g);
                    svgEl('text', { x: p.w / 2, y: p.h / 2 + 4, 'text-anchor': 'middle', class: 'lbl' }, g).textContent =
                        revealed ? `${name}=${v == null ? '–' : v}` : name;
                }
            });
            host.replaceChildren(svg);
            return { wrongOuts, suspects };
        }

        function renderTable(res) {
            const L = lv(), outs = outputNames();
            const isLive = r => inputNames().every(n => r[n] === live[n]);
            const head = `<tr>${inputNames().map(n => `<th>${esc(n)}</th>`).join('')}
                ${outs.map(o => `<th class="want">${esc(o)}</th>${revealed ? '<th>yours</th>' : ''}`).join('')}
                ${revealed ? '<th></th>' : ''}</tr>`;
            const body = res.map(({ r, got, ok }) => `
                <tr class="${revealed && isLive(r) ? 'live' + (ok && !isSolved(idx) ? ' live-part' : '') : ''}${revealed ? ' clickable' : ''}" data-row='${JSON.stringify(r)}'
                    ${revealed ? `tabindex="0" aria-label="Trace row ${inputNames().map(n => `${n}=${r[n]}`).join(' ')}"` : ''}>
                    ${inputNames().map(n => `<td>${r[n]}</td>`).join('')}
                    ${outs.map(o => `<td class="want">${L.target[o](r)}</td>${revealed ? `<td class="got">${got[o] == null ? '–' : got[o]}</td>` : ''}`).join('')}
                    ${revealed ? `<td class="${ok ? (isSolved(idx) ? 'ok' : 'part') : 'bad'}">${ok ? '✓' : '✗'}</td>` : ''}
                </tr>`).join('');
            $('#logicTable').innerHTML = `<caption>${revealed ? 'Tap a row' : 'Target'}</caption><thead>${head}</thead><tbody>${body}</tbody>`;
            const liveRow = $('#logicTable tr.live');
            const wrap = $('.logic-table-wrap');
            if (liveRow && wrap && wrap.scrollHeight > wrap.clientHeight) {
                const top = liveRow.offsetTop, bottom = top + liveRow.offsetHeight;
                if (top < wrap.scrollTop + 30 || bottom > wrap.scrollTop + wrap.clientHeight) wrap.scrollTop = top - wrap.clientHeight / 2;
            }
        }

        function renderLesson() {
            const L = lv(), box = $('#logicLesson');
            if (mode !== 'classic') { box.hidden = true; return; }
            box.hidden = false;
            box.innerHTML = `<span class="logic-lesson-kicker">${esc(L.kicker)}</span>
                <p>${esc(L.about)}</p>
                <div class="logic-eq"><span>Target</span><code>${esc(L.eq)}</code></div>`;
        }

        function renderExpr() {
            const el = $('#logicExpr');
            if (usingCode()) { el.hidden = true; return; }
            el.hidden = false;
            const lines = equationLines(lv(), types);
            el.innerHTML = `<span>Your circuit</span>${lines.map(l => `<code>${esc(l)}</code>`).join('')}`;
        }

        function renderCode(res) {
            const panel = $('#logicCode');
            if (mode !== 'verilog') { panel.hidden = true; return; }
            panel.hidden = false;
            const solved = isSolved(idx), code = usingCode();
            $$('[data-logic-method]').forEach(b => {
                const on = b.dataset.logicMethod === method;
                b.classList.toggle('active', on);
                b.setAttribute('aria-pressed', String(on));
                b.disabled = solved;
            });
            const input = $('#logicCodeInput'), view = $('#logicCodeView');
            input.hidden = !code;
            input.readOnly = solved;
            view.hidden = code;
            if (!code) view.textContent = verilogFromGates(lv(), types, moduleName());
            $('#logicCopyGates').hidden = !code || solved;
            $('#logicCodeLabel').textContent = code ? 'Your Verilog' : 'Your circuit as Verilog (read-only)';

            const msg = $('#logicCodeMsg');
            if (codeError) {
                msg.className = 'logic-code-msg err';
                msg.textContent = `Line ${codeError.line}: ${codeError.message}. Fix it and submit again (no attempt used).`;
            } else if (code && revealed && compiled) {
                const env = compiled.run(live);
                const sigs = compiled.signals.filter(s => !inputNames().includes(s));
                msg.className = 'logic-code-msg';
                msg.innerHTML = `<span>Simulation</span>${inputNames().map(n => `<b>${esc(n)}=${live[n]}</b>`).join(' ')} &rarr; ${sigs.map(s => `${esc(s)}=${env[s]}`).join('  ')}`;
            } else {
                msg.className = 'logic-code-msg';
                msg.textContent = code ? 'Write assign statements or gate primitives, then submit.' : 'Prefer typing? Switch to Verilog and write the logic yourself.';
            }
        }

        function msToMidnight() {
            const now = new Date(), mid = new Date(now);
            mid.setHours(24, 0, 0, 0);
            const s = Math.max(0, Math.floor((mid - now) / 1000));
            return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
        }
        const mark = s => (!s ? '⬛' : s.attempts === 1 ? '🟩' : s.attempts <= 5 ? '🟧' : s.attempts <= 10 ? '🟥' : '🟪');

        function render() {
            const L = lv(), res = results();
            const solved = isSolved(idx), wrong = res.filter(x => !x.ok).length;
            const solvedCount = levels.filter((_, i) => isSolved(i)).length;
            const allDone = solvedCount === levels.length;
            const circ = renderCircuit(res);
            renderTable(res);
            renderLesson();
            renderExpr();
            renderCode(res);

            $('#logicLevelNum').textContent = mode === 'classic'
                ? `Lesson ${idx + 1} of ${levels.length}`
                : `${MODES[mode].label} #${dailyNumber(todayKey)} · ${idx + 1} of ${levels.length}${L.hard && mode === 'verilog' ? ' · hard' : ''}`;
            $('#logicLevelName').textContent = L.name;

            const unlocked = unlockedUpTo();
            const dots = $('#logicDots');
            dots.classList.toggle('many', levels.length > 8);
            dots.innerHTML = levels.map((_, i) => {
                const locked = i > unlocked;
                return `<button class="logic-dot${i === idx ? ' current' : ''}${isSolved(i) ? ' solved' : ''}${locked ? ' locked' : ''}"
                    data-level="${i}" ${locked ? 'disabled' : ''} aria-label="${mode === 'classic' ? 'Lesson' : 'Puzzle'} ${i + 1}${isSolved(i) ? ' (solved)' : locked ? ' (locked)' : ''}">${locked ? '<i class="fas fa-lock"></i>' : i + 1}</button>`;
            }).join('');

            const setCount = L.gates.filter(g => types[g.id]).length;
            let msg;
            clearInterval(countdown);
            if (solved && mode !== 'classic' && allDone) {
                const left = DAILY_MODES.filter(m => m !== mode && !(loadDay()[m] && makeDay(todayKey)[m].every((_, i) => loadDay()[m].solved[i])));
                msg = `<b class="win">All ${levels.length} solved!</b> ${levels.map((_, i) => mark(progress.solved[i])).join('')} New puzzles in <span id="logicCountdown">${msToMidnight()}</span>.${left.length ? ` Try ${MODES[left[0]].label} next.` : ''}`;
                countdown = setInterval(() => {
                    const el = $('#logicCountdown');
                    if (!el) return clearInterval(countdown);
                    if (dateKey(new Date()) !== todayKey) { clearInterval(countdown); setMode(mode); return; }
                    el.textContent = msToMidnight();
                }, 1000);
            } else if (solved) {
                const lastClassic = mode === 'classic' && idx === levels.length - 1;
                msg = `<b class="win">Solved in ${attempts} attempt${attempts === 1 ? '' : 's'}!</b> ${lastClassic ? 'That’s the logic behind a JK flip-flop. Try today’s Daily puzzles next.' : idx < levels.length - 1 ? 'The next one is unlocked.' : ''}`;
            } else if (codeError) {
                msg = `<b>Your Verilog didn’t compile.</b> See the message under the editor.`;
            } else if (revealed) {
                const hint = circ.suspects.size ? ' Dashed gates feed a wrong output.' : '';
                msg = `Attempt ${attempts}: <b>${wrong} of ${res.length} rows wrong.</b> Tap a row to trace its signals.${hint}`;
            } else if (!allSet()) {
                msg = `Set every gate (<b>${setCount} of ${L.gates.length}</b>), then submit.`;
            } else {
                msg = `Ready? <b>Submit</b> to check all ${res.length} rows${attempts ? ` (attempt ${attempts + 1})` : ''}.`;
            }
            $('#logicStatus').innerHTML = msg;

            const submitBtn = $('#logicSubmit'), nextBtn = $('#logicNext'), shareBtn = $('#logicShare');
            submitBtn.hidden = solved;
            submitBtn.disabled = !allSet() || revealed;
            nextBtn.hidden = !(solved && idx < levels.length - 1);
            shareBtn.hidden = !(mode !== 'classic' && allDone);

            $('#logicStatLevelLabel').textContent = mode === 'classic' ? 'Lesson' : 'Puzzle';
            $('#logicStatLevel').textContent = `${idx + 1} / ${levels.length}`;
            $('#logicStatTries').textContent = attempts;
            $('#logicStatSolved').textContent = `${solvedCount} / ${levels.length}`;
            $('#logicStatStreak').textContent = streak();
        }

        /* ---------------- interaction ---------------- */
        const act = (target, back) => {
            const gate = target.closest('[data-gate]'), input = target.closest('[data-input]');
            if (gate && !isSolved(idx) && !usingCode()) {
                const id = gate.dataset.gate, g = lv().gates.find(x => x.id === id);
                const pal = paletteFor(g);
                const cur = pal.indexOf(types[id]);
                types[id] = pal[(cur + (back ? pal.length - 1 : 1) + (cur < 0 && back ? 1 : 0)) % pal.length];
                revealed = false;               // any change hides the results again
                render();
                const again = host.querySelector(`[data-gate="${id}"]`);
                if (again) again.focus();
            } else if (input && revealed) {
                const id = input.dataset.input;
                live[id] = 1 - live[id];
                render();
                const again = host.querySelector(`[data-input="${id}"]`);
                if (again) again.focus();
            }
        };
        host.addEventListener('click', e => act(e.target, e.shiftKey));
        host.addEventListener('contextmenu', e => { if (e.target.closest('[data-gate]')) { e.preventDefault(); act(e.target, true); } });
        host.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(e.target, e.shiftKey); }
        });
        const traceRow = tr => {
            if (!tr || !revealed) return;
            live = JSON.parse(tr.dataset.row);
            render();
            const again = $(`#logicTable tr[data-row='${tr.dataset.row}']`);
            if (again && document.activeElement && document.activeElement.closest('#logicTable')) again.focus();
        };
        $('#logicTable').addEventListener('click', e => traceRow(e.target.closest('tr[data-row]')));
        $('#logicTable').addEventListener('keydown', e => {
            const tr = e.target.closest('tr[data-row]');
            if (!tr) return;
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); traceRow(tr); }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const sib = e.key === 'ArrowDown' ? tr.nextElementSibling : tr.previousElementSibling;
                if (sib) { sib.focus(); traceRow(sib); }
            }
        });
        $('#logicDots').addEventListener('click', e => { const b = e.target.closest('[data-level]'); if (b && !b.disabled) open(+b.dataset.level); });
        $('#logicSubmit').addEventListener('click', submit);
        $('#logicNext').addEventListener('click', () => open(idx + 1));
        $$('[data-logic-mode]').forEach(b => b.addEventListener('click', () => { if (b.dataset.logicMode !== mode) setMode(b.dataset.logicMode); }));

        // Verilog editor
        $$('[data-logic-method]').forEach(b => b.addEventListener('click', () => {
            if (b.dataset.logicMethod === method || isSolved(idx)) return;
            method = b.dataset.logicMethod;
            revealed = false;
            codeError = null;
            compiled = null;
            render();
        }));
        let draftTimer = null;
        $('#logicCodeInput').addEventListener('input', () => {
            if (revealed || codeError) { revealed = false; codeError = null; render(); }
            clearTimeout(draftTimer);
            draftTimer = setTimeout(() => { progress.drafts[idx] = codeText(); save(); }, 400);
        });
        $('#logicCodeInput').addEventListener('keydown', e => {
            if (e.key === 'Tab' && !e.shiftKey) {   // indent instead of leaving the editor
                e.preventDefault();
                const t = e.target, s = t.selectionStart;
                t.setRangeText('    ', s, t.selectionEnd, 'end');
                t.dispatchEvent(new Event('input'));
            }
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); }
        });
        $('#logicCopyGates').addEventListener('click', () => {
            $('#logicCodeInput').value = verilogFromGates(lv(), types, moduleName());
            $('#logicCodeInput').dispatchEvent(new Event('input'));
        });

        $('#logicShare').addEventListener('click', async () => {
            const marks = levels.map((_, i) => mark(progress.solved[i])).join('');
            const total = levels.reduce((n, _, i) => n + (progress.solved[i] ? progress.solved[i].attempts : 0), 0);
            const name = mode === 'daily' ? 'Logic Gates Daily' : `Logic Gates ${MODES[mode].label}`;
            const text = `${name} #${dailyNumber(todayKey)}: ${total} attempts\n${marks}\n${location.origin}${location.pathname}#playground`;
            const btn = $('#logicShare');
            try {
                if (navigator.share && window.matchMedia('(pointer: coarse)').matches) await navigator.share({ text });
                else { await navigator.clipboard.writeText(text); btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Share result'; }, 2000); }
            } catch (e) { /* share sheet cancelled */ }
        });

        setMode('classic');
    }

    // exposed for testing in the console
    window.__logicGame = { makeDay, compileVerilog, LESSONS, TEMPLATES, GATES, evalCircuit, allVectors };
    document.addEventListener('DOMContentLoaded', initLogic);
})();
