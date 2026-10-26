import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PresentationTransport } from '../dist/index.js';

/**
 * A deterministic stand-in for a host clock. It owns no wall-clock timer: a
 * test advances it by invoking the queued callback explicitly, which is what
 * makes "a cancelled callback is delivered anyway" reproducible.
 */
function createHost(transport) {
  let queue = [];
  let generation = 0;
  let running = false;

  const invalidate = () => {
    generation += 1;
    queue = [];
  };

  const schedule = () => {
    invalidate();
    const current = generation;
    queue.push(() => {
      if (current !== generation) {
        return;
      }
      const state = transport.advance();
      if (running && state.canAdvance) {
        schedule();
      }
    });
  };

  return {
    play() {
      running = true;
      if (transport.state.wait === null) {
        schedule();
      }
    },
    pause() {
      running = false;
      invalidate();
    },
    /** The next queued callback, captured so it can be invoked after cancellation. */
    pending() {
      return queue[0] ?? null;
    },
    step() {
      const callback = queue.shift();
      if (callback) {
        callback();
      }
    },
    /** Re-arm the clock after a caller release while playback was running. */
    resume() {
      if (running && transport.state.canAdvance) {
        schedule();
      }
    },
    seek(index) {
      invalidate();
      return transport.seek(index);
    },
    dispose() {
      invalidate();
      transport.dispose();
    },
    get running() {
      return running;
    }
  };
}

function plan(segments, barriers = []) {
  return { segments, barriers };
}

describe('PresentationTransport — ordinary unsegmented playback', () => {
  it('advances one step at a time and stops at the physical end', () => {
    const transport = new PresentationTransport(3);
    assert.equal(transport.state.cursor, -1);
    assert.equal(transport.state.status, 'idle');

    assert.equal(transport.advance().cursor, 0);
    assert.equal(transport.advance().cursor, 1);
    assert.equal(transport.advance().cursor, 2);
    const end = transport.advance();
    assert.equal(end.cursor, 2);
    assert.equal(end.status, 'ended');
    assert.equal(end.canAdvance, false);
  });

  it('clamps finite seeks and ignores non-finite or fractional indices', () => {
    const transport = new PresentationTransport(4);
    assert.equal(transport.seek(99).cursor, 3);
    assert.equal(transport.seek(-99).cursor, -1);
    assert.equal(transport.seek(2).cursor, 2);

    for (const invalid of [NaN, Infinity, -Infinity, 1.5]) {
      const state = transport.seek(invalid);
      assert.equal(state.cursor, 2, `ignored ${String(invalid)}`);
      assert.equal(state.wait, null);
    }
  });

  it('keeps an empty timeline inert', () => {
    const transport = new PresentationTransport(0);
    const state = transport.advance();
    assert.equal(state.cursor, -1);
    assert.equal(state.status, 'ended');
    assert.equal(state.canAdvance, false);
    assert.equal(transport.seek(0).cursor, -1);
  });
});

describe('PresentationTransport — barriers and opaque tickets', () => {
  const segmentedPlan = plan(
    [
      { id: 'brief', startIndex: 0, endIndex: 4 },
      { id: 'discussion', startIndex: 5, endIndex: 9 }
    ],
    [{ id: 'result', segmentId: 'brief', atIndex: 2 }]
  );

  it('stops at a barrier with a current ticket and keeps waiting while idle', () => {
    const transport = new PresentationTransport(10, segmentedPlan);
    assert.equal(transport.advance().cursor, 0);
    assert.equal(transport.advance().cursor, 1);
    const waiting = transport.advance();
    assert.equal(waiting.cursor, 2);
    assert.equal(waiting.status, 'waiting');
    assert.equal(waiting.segmentId, 'brief');
    assert.equal(waiting.wait?.barrierId, 'result');
    assert.equal(waiting.wait?.atIndex, 2);
    assert.equal(waiting.canAdvance, false);

    // Doing nothing keeps it waiting: repeated ticks cannot move past.
    assert.equal(transport.advance().cursor, 2);
    assert.equal(transport.advance().status, 'waiting');
  });

  it('releases the exact ticket once and resumes inside the same segment', () => {
    const transport = new PresentationTransport(10, segmentedPlan);
    transport.advance();
    transport.advance();
    const waiting = transport.advance();
    const ticket = waiting.wait;
    assert.ok(ticket);

    const before = transport.state.cursor;
    assert.equal(transport.releaseWait(ticket), true);
    assert.equal(transport.state.cursor, before, 'release does not advance');
    assert.equal(transport.state.wait, null);
    assert.equal(transport.releaseWait(ticket), false, 'duplicate release rejected');

    assert.equal(transport.advance().cursor, 3);
    assert.equal(transport.advance().cursor, 4);
    assert.equal(transport.advance().status, 'segment-end');
  });

  it('rejects forged, previous-lifetime and other-transport tickets', () => {
    const first = new PresentationTransport(10, segmentedPlan);
    first.advance();
    first.advance();
    const ticket = first.advance().wait;
    assert.ok(ticket);
    first.seek(1); // revokes the ticket
    assert.equal(first.releaseWait(ticket), false);
    assert.equal(first.state.wait, null);

    const second = new PresentationTransport(10, segmentedPlan);
    second.advance();
    second.advance();
    const secondTicket = second.advance().wait;
    assert.ok(secondTicket);
    assert.equal(secondTicket.id, ticket.id, 'both first tickets use scalar id 1');
    assert.equal(second.releaseWait(ticket), false, 'other transport ticket rejected');
    assert.equal(second.releaseWait({ ...secondTicket }), false, 'structurally equal copy rejected');
    assert.equal(second.releaseWait(secondTicket), true);
  });

  it('never opens a ticket during watch/seek', () => {
    const transport = new PresentationTransport(10, segmentedPlan);
    const watched = transport.seek(6);
    assert.equal(watched.status, 'preview');
    assert.equal(watched.wait, null);
    assert.equal(transport.seek(4).wait, null);
    assert.equal(transport.state.wait, null);
  });

  it('a preview past a barrier is clamped back to the earliest open barrier on Play', () => {
    const transport = new PresentationTransport(10, segmentedPlan);
    assert.equal(transport.seek(4).cursor, 4, 'watch may preview past the barrier');
    assert.equal(transport.state.wait, null);
    const playing = transport.advance();
    assert.equal(playing.cursor, 2);
    assert.equal(playing.status, 'waiting');
    assert.equal(playing.wait?.barrierId, 'result');
  });

  it('a seek exactly onto a barrier still requires its ticket before advancing', () => {
    const transport = new PresentationTransport(10, segmentedPlan);
    assert.equal(transport.seek(2).wait, null);
    const state = transport.advance();
    assert.equal(state.cursor, 2);
    assert.equal(state.status, 'waiting');
    assert.ok(state.wait);
  });
});

describe('PresentationTransport — segment boundaries and explicit outer Next', () => {
  const segmentedPlan = plan([
    { id: 'one', startIndex: 0, endIndex: 2 },
    { id: 'two', startIndex: 3, endIndex: 5 }
  ]);

  it('segment end awaits explicit enterSegment instead of auto-advancing', () => {
    const transport = new PresentationTransport(6, segmentedPlan);
    transport.advance();
    transport.advance();
    assert.equal(transport.advance().cursor, 2);
    for (let attempt = 0; attempt < 3; attempt++) {
      const state = transport.advance();
      assert.equal(state.cursor, 2);
      assert.equal(state.status, 'segment-end');
      assert.equal(state.segmentId, 'one');
    }

    const entered = transport.enterSegment('two');
    assert.equal(entered.cursor, 3, 'the new segment opens on its first step');
    assert.equal(entered.status, 'idle');
    assert.equal(entered.segmentId, 'two');
    assert.equal(transport.advance().cursor, 4);
  });

  it('a barrier at the segment end gates before the segment-end state', () => {
    const planWithBarrier = plan(
      [
        { id: 'one', startIndex: 0, endIndex: 2 },
        { id: 'two', startIndex: 3, endIndex: 5 }
      ],
      [{ id: 'last', segmentId: 'one', atIndex: 2 }]
    );
    const transport = new PresentationTransport(6, planWithBarrier);
    transport.advance();
    transport.advance();
    assert.equal(transport.advance().status, 'waiting');
    assert.equal(transport.releaseWait(transport.state.wait), true);
    assert.equal(transport.advance().status, 'segment-end');
  });

  it('rejects an unknown segment id without changing state', () => {
    const transport = new PresentationTransport(6, segmentedPlan);
    transport.advance();
    assert.throws(() => transport.enterSegment('missing'), RangeError);
    assert.equal(transport.state.cursor, 0);
  });
});

describe('PresentationTransport — pause and cancellation semantics', () => {
  const segmentedPlan = plan(
    [
      { id: 'brief', startIndex: 0, endIndex: 4 },
      { id: 'discussion', startIndex: 5, endIndex: 9 }
    ],
    [{ id: 'result', segmentId: 'brief', atIndex: 2 }]
  );

  it('pause while waiting retains the ticket and revokes scheduled callbacks', () => {
    const transport = new PresentationTransport(10, segmentedPlan);
    const host = createHost(transport);
    host.play();
    host.step();
    host.step();
    host.step();
    assert.equal(transport.state.status, 'waiting');

    const ticket = transport.state.wait;
    const pendingBeforePause = host.pending();
    host.pause();
    assert.equal(transport.state.wait, ticket, 'safe wait retained across pause');
    assert.equal(pendingBeforePause, null, 'no advance callback was left queued');

    const released = transport.releaseWait(ticket);
    assert.equal(released, true);
    assert.equal(host.running, false, 'release does not restart playback');
    assert.equal(host.pending(), null, 'release schedules no frame');
    assert.equal(transport.state.wait, null);
    assert.equal(transport.state.cursor, 2, 'release does not advance');
  });

  it('a cancelled callback delivered after seek cannot advance reconstructed state', () => {
    const transport = new PresentationTransport(10, segmentedPlan);
    const host = createHost(transport);
    host.play();
    host.step();
    host.step();
    const late = host.pending();
    assert.ok(late);

    host.seek(3);
    assert.equal(transport.state.cursor, 3);
    late();
    assert.equal(transport.state.cursor, 3, 'stale callback did not move the cursor');
    assert.equal(transport.state.wait, null);
  });

  it('a cancelled callback after pause cannot reopen a wait or move', () => {
    const transport = new PresentationTransport(10, segmentedPlan);
    const host = createHost(transport);
    host.play();
    host.step();
    const late = host.pending();
    assert.ok(late);

    host.pause();
    late();
    assert.equal(transport.state.cursor, 0);
    assert.equal(transport.state.wait, null);
  });

  it('a callback delivered after dispose cannot restart the transport', () => {
    const transport = new PresentationTransport(10, segmentedPlan);
    const host = createHost(transport);
    host.play();
    host.step();
    const late = host.pending();
    host.dispose();
    assert.equal(transport.state.status, 'disposed');
    late();
    assert.equal(transport.state.status, 'disposed');
    assert.equal(transport.state.cursor, 0);
    assert.equal(transport.releaseWait(transport.state.wait), false);
  });

  it('reset revokes the ticket and clears released barriers for the new context', () => {
    const transport = new PresentationTransport(10, segmentedPlan);
    transport.advance();
    transport.advance();
    const ticket = transport.advance().wait;
    assert.ok(ticket);
    assert.equal(transport.releaseWait(ticket), true);
    assert.equal(transport.advance().cursor, 3);

    transport.seek(1);
    const state = transport.reset();
    assert.equal(state.cursor, -1);
    assert.equal(state.wait, null);
    assert.equal(transport.releaseWait(ticket), false);

    transport.advance();
    transport.advance();
    const reopened = transport.advance();
    assert.equal(reopened.status, 'waiting', 'the barrier applies again in a new lifetime');
    assert.notEqual(reopened.wait?.id, ticket.id);
  });
});

describe('PresentationTransport — canAdvance admits every required host transition', () => {
  /**
   * The documented host loop: a host schedules another advance only while the
   * current state says `canAdvance`. Reaching a wait or a terminal state must
   * therefore be possible without the host guessing at an extra tick.
   */
  function driveToRest(transport) {
    let ticks = 0;
    while (transport.state.canAdvance) {
      if (++ticks > 64) {
        throw new Error('host never reached a rest state');
      }
      transport.advance();
    }
    return transport.state;
  }

  it('reaches waiting after a preview seek to the segment end beyond a barrier', () => {
    const transport = new PresentationTransport(
      3,
      plan(
        [{ id: 'one', startIndex: 0, endIndex: 2 }],
        [{ id: 'gate', segmentId: 'one', atIndex: 1 }]
      )
    );
    assert.equal(transport.seek(2).status, 'preview');
    assert.equal(transport.state.canAdvance, true, 'the open barrier keeps admission live');

    const reached = driveToRest(transport);
    assert.equal(reached.status, 'waiting');
    assert.equal(reached.cursor, 1);
    assert.equal(reached.wait?.barrierId, 'gate');
    assert.equal(reached.canAdvance, false);
  });

  it('reaches waiting in a one-step segment whose only index is a barrier', () => {
    const transport = new PresentationTransport(
      1,
      plan(
        [{ id: 'only', startIndex: 0, endIndex: 0 }],
        [{ id: 'gate', segmentId: 'only', atIndex: 0 }]
      )
    );
    assert.equal(transport.enterSegment('only').status, 'idle');
    assert.equal(transport.state.canAdvance, true, 'the unresolved barrier keeps admission live');

    const reached = driveToRest(transport);
    assert.equal(reached.status, 'waiting');
    assert.equal(reached.cursor, 0);
    assert.equal(reached.wait?.atIndex, 0);
  });

  it('reaches segment-end for ordinary segmented playback', () => {
    const transport = new PresentationTransport(3, plan([{ id: 'one', startIndex: 0, endIndex: 2 }]));
    const reached = driveToRest(transport);
    assert.equal(reached.status, 'segment-end');
    assert.equal(reached.cursor, 2);
    assert.equal(reached.canAdvance, false);
  });

  it('reaches ended for ordinary unsegmented playback', () => {
    const transport = new PresentationTransport(3);
    const reached = driveToRest(transport);
    assert.equal(reached.status, 'ended');
    assert.equal(reached.cursor, 2);
    assert.equal(reached.canAdvance, false);
  });

  it('reaches segment-end after a preview seek to the end without a barrier', () => {
    const transport = new PresentationTransport(3, plan([{ id: 'one', startIndex: 0, endIndex: 2 }]));
    assert.equal(transport.seek(2).status, 'preview');
    assert.equal(driveToRest(transport).status, 'segment-end');
  });

  it('leaves exactly one documented advance after a paused release at a final-index barrier', () => {
    const transport = new PresentationTransport(
      3,
      plan(
        [{ id: 'one', startIndex: 0, endIndex: 2 }],
        [{ id: 'gate', segmentId: 'one', atIndex: 2 }]
      )
    );
    const waiting = driveToRest(transport);
    assert.equal(waiting.status, 'waiting');
    assert.ok(waiting.wait);

    assert.equal(transport.releaseWait(waiting.wait), true);
    const idle = transport.state;
    assert.equal(idle.status, 'idle');
    assert.equal(idle.cursor, 2);
    assert.equal(idle.canAdvance, true, 'the released final barrier still admits its terminal tick');

    assert.equal(driveToRest(transport).status, 'segment-end');
  });
});

describe('PresentationTransport — caller-input validation and snapshotting', () => {
  const validSegments = [
    { id: 'a', startIndex: 0, endIndex: 1 },
    { id: 'b', startIndex: 2, endIndex: 3 }
  ];

  it('rejects invalid step counts and plans before exposing a state', () => {
    assert.throws(() => new PresentationTransport(-1), RangeError);
    assert.throws(() => new PresentationTransport(1.5), RangeError);
    assert.throws(() => new PresentationTransport(3, plan([{ id: 'gap', startIndex: 1, endIndex: 2 }])), /start at step 0/);
    assert.throws(() => new PresentationTransport(4, plan([{ id: 'short', startIndex: 0, endIndex: 2 }])), /cover the whole timeline/);
    assert.throws(
      () =>
        new PresentationTransport(
          4,
          plan([
            { id: 'a', startIndex: 0, endIndex: 1 },
            { id: 'b', startIndex: 1, endIndex: 3 }
          ])
        ),
      /contiguous/
    );
    assert.throws(
      () => new PresentationTransport(4, plan([{ id: 'a', startIndex: 0, endIndex: 4 }])),
      /outside/
    );
    assert.throws(
      () => new PresentationTransport(4, plan([...validSegments, { id: 'c', startIndex: 4, endIndex: 3 }])),
      /invalid range/
    );
    assert.throws(
      () =>
        new PresentationTransport(4, {
          segments: validSegments,
          barriers: [{ id: 'x', segmentId: 'missing', atIndex: 0 }]
        }),
      /unknown segment/
    );
    assert.throws(
      () =>
        new PresentationTransport(4, {
          segments: validSegments,
          barriers: [{ id: 'x', segmentId: 'a', atIndex: 3 }]
        }),
      /outside segment/
    );
    assert.throws(
      () =>
        new PresentationTransport(4, {
          segments: validSegments,
          barriers: [
            { id: 'x', segmentId: 'a', atIndex: 1 },
            { id: 'y', segmentId: 'a', atIndex: 1 }
          ]
        }),
      /more than one barrier/
    );
    assert.throws(
      () =>
        new PresentationTransport(4, {
          segments: validSegments,
          barriers: [
            { id: 'x', segmentId: 'a', atIndex: 1 },
            { id: 'x', segmentId: 'b', atIndex: 2 }
          ]
        }),
      /duplicate presentation barrier id/
    );
    assert.throws(
      () => new PresentationTransport(0, plan([{ id: 'none', startIndex: 0, endIndex: 0 }])),
      /outside/
    );
    assert.throws(
      () => new PresentationTransport(4, { segments: validSegments, barriers: null }),
      /segments.*barriers/
    );
  });

  it('snapshots caller arrays so later mutation cannot change bindings', () => {
    const segments = [
      { id: 'a', startIndex: 0, endIndex: 0 },
      { id: 'b', startIndex: 1, endIndex: 1 }
    ];
    const barriers = [{ id: 'gate', segmentId: 'a', atIndex: 0 }];
    const transport = new PresentationTransport(2, { segments, barriers });

    segments.length = 0;
    barriers[0].atIndex = 1;
    delete barriers[0].segmentId;

    const state = transport.advance();
    assert.equal(state.status, 'waiting');
    assert.equal(state.cursor, 0);
    assert.equal(transport.advance().status, 'waiting');
    assert.equal(transport.state.cursor, 0);
  });

  it('exposes frozen validated bindings for a host that retains the plan', () => {
    const segments = [
      { id: 'a', startIndex: 0, endIndex: 0 },
      { id: 'b', startIndex: 1, endIndex: 1 }
    ];
    const barriers = [{ id: 'gate', segmentId: 'a', atIndex: 0 }];
    const transport = new PresentationTransport(2, { segments, barriers });

    segments.length = 0;
    barriers[0].atIndex = 1;

    const bindings = transport.bindings;
    assert.equal(Object.isFrozen(bindings), true);
    assert.equal(Object.isFrozen(bindings.segments), true);
    assert.equal(Object.isFrozen(bindings.barriers), true);
    assert.deepEqual(
      bindings.segments.map((segment) => [segment.id, segment.startIndex, segment.endIndex]),
      [
        ['a', 0, 0],
        ['b', 1, 1]
      ]
    );
    assert.deepEqual(bindings.barriers.map((barrier) => [barrier.id, barrier.atIndex]), [['gate', 0]]);
    assert.equal(transport.advance().status, 'waiting');
    assert.equal(transport.state.cursor, 0);
  });

  it('repeated invalidation keeps state bounded, with no ticket history', () => {
    const transport = new PresentationTransport(
      2,
      plan(
        [
          { id: 'a', startIndex: 0, endIndex: 0 },
          { id: 'b', startIndex: 1, endIndex: 1 }
        ],
        [{ id: 'gate', segmentId: 'a', atIndex: 0 }]
      )
    );

    const stale = [];
    for (let round = 0; round < 50; round++) {
      transport.reset();
      const waiting = transport.advance();
      assert.equal(waiting.status, 'waiting');
      stale.push(waiting.wait);
      transport.seek(1);
      assert.equal(transport.releaseWait(waiting.wait), false);
    }

    assert.equal(Object.keys(transport.state).sort().join(','), 'canAdvance,cursor,segmentId,status,wait');
    assert.equal(transport.state.cursor, 1);
    assert.equal(transport.state.wait, null);
    assert.equal(stale.length, 50);
    for (const ticket of stale) {
      assert.equal(transport.releaseWait(ticket), false);
    }
  });
});
