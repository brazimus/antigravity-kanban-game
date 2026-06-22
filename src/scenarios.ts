import type { Scenario } from './types';

export const easyModeScenario: Scenario = {
  id: 'easy_mode',
  name: 'Standard Software Project',
  description: 'Learn Kanban flow. Week 1 is unconstrained WIP (no limits). Week 2 introduces WIP limits, pairing, and focus time to accelerate delivery.',
  totalDays: 10,
  events: {
    1: {
      title: 'Project Kickoff (Day 1)',
      description: 'Welcome! You have a team of 3 developers: Alice, Bob, and Charlie. There are no WIP limits. Try to get as many cards as possible into Development to start working!',
      pairingAllowed: false,
      wipLimits: {
        backlog: null,
        ready: null,
        analysis: null,
        development: null,
        testing: null,
        done: null
      },
      newCards: [
        {
          title: 'User Login & Auth',
          description: 'Implement secure JWT login for users.',
          type: 'standard',
          columnId: 'analysis',
          effort: { analysis: 2, development: 4, testing: 2 },
        },
        {
          title: 'Database Schema Setup',
          description: 'Create postgres tables for users and items.',
          type: 'standard',
          columnId: 'analysis',
          effort: { analysis: 1, development: 3, testing: 1 },
        },
        {
          title: 'Landing Page Layout',
          description: 'Design and code the hero section and styling.',
          type: 'standard',
          columnId: 'ready',
          effort: { analysis: 2, development: 2, testing: 1 },
        },
        {
          title: 'API Gateway Proxy',
          description: 'Configure routing for backend services.',
          type: 'standard',
          columnId: 'ready',
          effort: { analysis: 3, development: 5, testing: 2 },
        },
        {
          title: 'Billing Module Draft',
          description: 'Draft mock integration with Stripe payments.',
          type: 'standard',
          columnId: 'backlog',
          effort: { analysis: 4, development: 6, testing: 3 },
        },
        {
          title: 'Analytics Pipeline',
          description: 'Set up tracking events for user dashboard.',
          type: 'standard',
          columnId: 'backlog',
          effort: { analysis: 3, development: 4, testing: 2 },
        }
      ]
    },
    3: {
      title: 'Capacity Bottleneck (Day 3)',
      description: "Bob has a doctor's appointment today. His capacity is reduced by 2 points.",
      capacityChange: [
        {
          avatarId: 'bob',
          description: 'Doctor appointment: capacity reduced by 2',
          rollModifier: -2
        }
      ]
    },
    5: {
      title: 'A Critical Blocker (Day 5)',
      description: 'An active development item gets blocked due to a server crash. We must resolve it. Since there are no WIP limits, notice how many items are piling up in the Development column.',
      blockCardId: 'random_dev_card',
      blockedReason: 'API server crash: external dependency offline.'
    },
    6: {
      title: 'Adopting Kanban & WIP Limits (Day 6)',
      description: 'Week 2 starts! The team adopts WIP limits: Analysis (2), Development (2), and Testing (1). Pairing is now enabled! If you assign two developers to the same card, the helper gets 50% capacity but rolls with advantage to ignore blocker checks.',
      pairingAllowed: true,
      wipLimits: {
        backlog: null,
        ready: null,
        analysis: 2,
        development: 2,
        testing: 1,
        done: null
      }
    },
    8: {
      title: 'Production Outage! (Day 8)',
      description: 'An urgent Production Hotfix card has arrived in the Ready column. It is marked EXPEDITE and is allowed to bypass WIP limits. Focus all hands on this card!',
      newCards: [
        {
          title: 'Production Hotfix: Login Loop',
          description: 'Users cannot log in after yesterday\'s release. FIX IMMEDIATELY.',
          type: 'expedite',
          columnId: 'ready',
          effort: { analysis: 0, development: 2, testing: 1 },
        }
      ]
    }
  }
};

export const defaultColumns = [
  { id: 'backlog', name: 'Backlog', wipLimit: null, allowedEffortTypes: [] },
  { id: 'ready', name: 'Ready', wipLimit: null, allowedEffortTypes: [] },
  { id: 'analysis', name: 'Analysis', wipLimit: null, allowedEffortTypes: ['analysis'] },
  { id: 'development', name: 'Development', wipLimit: null, allowedEffortTypes: ['development'] },
  { id: 'testing', name: 'Testing', wipLimit: null, allowedEffortTypes: ['testing'] },
  { id: 'done', name: 'Done', wipLimit: null, allowedEffortTypes: [] }
];

export const defaultAvatars = [
  { id: 'alice', name: 'Alice', color: '#ec4899', currentRoll: null, assignedCardId: null, previousCardId: null, spentCapacity: 0 },
  { id: 'bob', name: 'Bob', color: '#3b82f6', currentRoll: null, assignedCardId: null, previousCardId: null, spentCapacity: 0 },
  { id: 'charlie', name: 'Charlie', color: '#10b981', currentRoll: null, assignedCardId: null, previousCardId: null, spentCapacity: 0 }
];
