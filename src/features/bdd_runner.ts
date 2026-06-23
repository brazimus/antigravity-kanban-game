import { describe, it } from 'vitest';

type StepFn = (context: any, ...args: any[]) => void | Promise<void>;

interface StepDefinition {
  regex: RegExp;
  fn: StepFn;
}

interface Scenario {
  name: string;
  steps: { keyword: string; text: string }[];
}

interface Feature {
  name: string;
  scenarios: Scenario[];
}

export class BddRunner {
  private steps: StepDefinition[] = [];

  public register(regex: RegExp, fn: StepFn) {
    this.steps.push({ regex, fn });
  }

  public runFeature(featureContent: string, contextCreator: () => any) {
    const lines = featureContent.split('\n');
    const features: Feature[] = [];
    let currentFeature: Feature | null = null;
    let currentScenario: Scenario | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      if (line.startsWith('Feature:')) {
        currentFeature = {
          name: line.replace('Feature:', '').trim(),
          scenarios: []
        };
        features.push(currentFeature);
        currentScenario = null;
      } else if (line.startsWith('Scenario:')) {
        if (!currentFeature) {
          currentFeature = { name: 'Default Feature', scenarios: [] };
          features.push(currentFeature);
        }
        currentScenario = {
          name: line.replace('Scenario:', '').trim(),
          steps: []
        };
        currentFeature.scenarios.push(currentScenario);
      } else if (currentScenario && (line.startsWith('Given ') || line.startsWith('When ') || line.startsWith('Then ') || line.startsWith('And ') || line.startsWith('But '))) {
        const keyword = line.split(' ')[0];
        const text = line.substring(keyword.length).trim();
        currentScenario.steps.push({ keyword, text });
      }
    }

    // Now execute them using describe and it
    features.forEach(feature => {
      describe(feature.name, () => {
        feature.scenarios.forEach(scenario => {
          it(scenario.name, async () => {
            const context = contextCreator();
            for (const step of scenario.steps) {
              let matched = false;
              for (const stepDef of this.steps) {
                const match = stepDef.regex.exec(step.text);
                if (match) {
                  matched = true;
                  const args = match.slice(1).map(arg => {
                    const num = Number(arg);
                    return isNaN(num) ? arg : num;
                  });
                  await stepDef.fn(context, ...args);
                  break;
                }
              }
              if (!matched) {
                throw new Error(`No matching step definition found for: ${step.keyword} ${step.text}`);
              }
            }
          });
        });
      });
    });
  }
}
