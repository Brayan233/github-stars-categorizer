import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import { AnalysisProgress } from '../AnalysisProgress.js';

describe('AnalysisProgress Component', () => {
  it('should display progress count and percentage', () => {
    const { lastFrame } = render(
      <AnalysisProgress current={5} total={10} />
    );

    const output = lastFrame();
    
    expect(output).toContain('Analyzing');
    expect(output).toContain('5');
    expect(output).toContain('10');
    expect(output).toContain('50%');
  });

  it('should show repo being analyzed', () => {
    const { lastFrame } = render(
      <AnalysisProgress 
        current={1} 
        total={5} 
        repo="facebook/react"
        cached={false}
        category="Frontend Frameworks"
        confidence={95}
      />
    );

    const output = lastFrame();
    
    expect(output).toContain('→'); // analyzing indicator
    expect(output).toContain('facebook/react');
    expect(output).toContain('Frontend Frameworks');
    expect(output).toContain('95%');
  });

  it('should indicate cached results with checkmark', () => {
    const { lastFrame } = render(
      <AnalysisProgress 
        current={1} 
        total={5} 
        repo="nestjs/nest"
        cached={true}
      />
    );

    const output = lastFrame();
    
    expect(output).toContain('✓'); // cached indicator
    expect(output).toContain('nestjs/nest');
  });

  it('should show spinner when analyzing', () => {
    const { lastFrame } = render(
      <AnalysisProgress 
        current={3} 
        total={10}
        repo="some/repo"
        cached={false}
      />
    );

    const output = lastFrame();
    
    // Spinner renders (dots animation)
    expect(output).toContain('→');
    expect(output).toContain('some/repo');
  });
});
