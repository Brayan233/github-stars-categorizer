import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import { Header } from '../Header.js';

describe('Header Component', () => {
  it('should display app name and version', () => {
    const { lastFrame } = render(
      <Header model="gemini-2.5-flash" concurrency={40} cacheTTL={360} />
    );

    const output = lastFrame();
    
    expect(output).toContain('🌟 GitHub Stars Categorizer');
    expect(output).toContain('v1.0.0');
  });

  it('should display model configuration', () => {
    const { lastFrame } = render(
      <Header model="gemini-2.5-pro" concurrency={20} cacheTTL={720} />
    );

    const output = lastFrame();
    
    expect(output).toContain('Model: gemini-2.5-pro');
    expect(output).toContain('Concurrency: 20 workers');
    expect(output).toContain('Cache TTL: 720h');
  });

  it('should handle missing optional props', () => {
    const { lastFrame } = render(<Header />);

    const output = lastFrame();
    
    expect(output).toContain('🌟 GitHub Stars Categorizer');
  });
});
