/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'

// Simple test to verify Jest setup
describe('Jest Setup', () => {
  it('should be able to run tests', () => {
    expect(true).toBe(true)
  })

  it('should have testing library available', () => {
    const div = document.createElement('div')
    div.textContent = 'Hello World'
    document.body.appendChild(div)
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })
})
