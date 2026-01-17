import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '../dialog';

describe('Dialog Components', () => {
  describe('Basic Dialog Functionality', () => {
    it('opens when trigger is clicked', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog Title</DialogTitle>
            <DialogDescription>Dialog content goes here.</DialogDescription>
          </DialogContent>
        </Dialog>
      );

      const trigger = screen.getByRole('button', { name: 'Open Dialog' });
      await user.click(trigger);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Dialog Title')).toBeInTheDocument();
      expect(screen.getByText('Dialog content goes here.')).toBeInTheDocument();
    });

    it('closes when close button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog Title</DialogTitle>
            <DialogDescription>Dialog content</DialogDescription>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole('button', { name: 'Open Dialog' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      const closeButton = screen.getByRole('button', { name: 'Close' });
      await user.click(closeButton);

      // Dialog should be removed from the document after closing
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes on Escape key press', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog Title</DialogTitle>
            <DialogDescription>Dialog content</DialogDescription>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole('button', { name: 'Open Dialog' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('does not render dialog content initially', () => {
      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog Title</DialogTitle>
            <DialogDescription>Should not be visible initially</DialogDescription>
          </DialogContent>
        </Dialog>
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByText('Should not be visible initially')).not.toBeInTheDocument();
    });
  });

  describe('Dialog Content Rendering', () => {
    it('renders dialog title correctly', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Test Dialog Title</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole('button', { name: 'Open' }));

      const dialog = screen.getByRole('dialog');
      const title = within(dialog).getByText('Test Dialog Title');
      expect(title).toBeInTheDocument();
    });

    it('renders dialog description correctly', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription>This is a description of the dialog.</DialogDescription>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole('button', { name: 'Open' }));

      expect(screen.getByText('This is a description of the dialog.')).toBeInTheDocument();
    });

    it('applies text-muted-foreground class to description', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription>Description text</DialogDescription>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole('button', { name: 'Open' }));

      const description = screen.getByText('Description text');
      expect(description).toHaveClass('text-sm');
      expect(description).toHaveClass('text-muted-foreground');
    });

    it('renders custom content inside dialog', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Form Dialog</DialogTitle>
            <div>
              <label htmlFor="name">Name</label>
              <input id="name" type="text" />
            </div>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole('button', { name: 'Open' }));

      expect(screen.getByLabelText('Name')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('Dialog Header and Footer', () => {
    it('renders DialogHeader with proper styles', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogHeader data-testid="dialog-header">
              <DialogTitle>Title in Header</DialogTitle>
              <DialogDescription>Description in Header</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole('button', { name: 'Open' }));

      const header = screen.getByTestId('dialog-header');
      expect(header).toHaveClass('flex');
      expect(header).toHaveClass('flex-col');
      expect(header).toHaveClass('space-y-1.5');
    });

    it('renders DialogFooter with proper styles', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <DialogFooter data-testid="dialog-footer">
              <button>Cancel</button>
              <button>Confirm</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole('button', { name: 'Open' }));

      const footer = screen.getByTestId('dialog-footer');
      expect(footer).toHaveClass('flex');
      expect(footer).toHaveClass('flex-col-reverse');
    });

    it('supports custom className on header and footer', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogHeader className="custom-header" data-testid="header">
              <DialogTitle>Title</DialogTitle>
            </DialogHeader>
            <DialogFooter className="custom-footer" data-testid="footer">
              <button>Action</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole('button', { name: 'Open' }));

      expect(screen.getByTestId('header')).toHaveClass('custom-header');
      expect(screen.getByTestId('footer')).toHaveClass('custom-footer');
    });
  });

  describe('Dialog with Actions', () => {
    it('handles action buttons in footer', async () => {
      const handleConfirm = vi.fn();
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Confirm Action</DialogTitle>
            <DialogDescription>Are you sure?</DialogDescription>
            <DialogFooter>
              <DialogClose asChild>
                <button>Cancel</button>
              </DialogClose>
              <button onClick={handleConfirm}>Confirm</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole('button', { name: 'Open' }));

      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      await user.click(confirmButton);

      expect(handleConfirm).toHaveBeenCalledTimes(1);
    });

    it('closes dialog when DialogClose is clicked', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <DialogFooter>
              <DialogClose asChild>
                <button>Close Dialog</button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole('button', { name: 'Open' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Close Dialog' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Focus Management', () => {
    it('traps focus inside dialog when open', async () => {
      const user = userEvent.setup();

      render(
        <div>
          <button>Outside Button</button>
          <Dialog>
            <DialogTrigger>Open Dialog</DialogTrigger>
            <DialogContent>
              <DialogTitle>Focus Test</DialogTitle>
              <input type="text" placeholder="Input 1" />
              <input type="text" placeholder="Input 2" />
            </DialogContent>
          </Dialog>
        </div>
      );

      await user.click(screen.getByRole('button', { name: 'Open Dialog' }));

      // Focus should be trapped in dialog
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();

      // Tab through focusable elements
      await user.tab();
      expect(screen.getByPlaceholderText('Input 1')).toHaveFocus();

      await user.tab();
      expect(screen.getByPlaceholderText('Input 2')).toHaveFocus();

      // Should wrap back to close button, not escape to outside button
      await user.tab();
      expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    });

    it('returns focus to trigger after closing', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle>Focus Return Test</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      const trigger = screen.getByRole('button', { name: 'Open Dialog' });
      await user.click(trigger);

      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA roles', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Accessible Dialog</DialogTitle>
            <DialogDescription>Description text</DialogDescription>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole('button', { name: 'Open' }));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('close button has accessible label', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole('button', { name: 'Open' }));

      const closeButton = screen.getByRole('button', { name: 'Close' });
      expect(closeButton).toBeInTheDocument();
    });

    it('supports custom className on content', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent className="custom-dialog-content">
            <DialogTitle>Title</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole('button', { name: 'Open' }));

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('custom-dialog-content');
    });

    it('applies proper semantic structure', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Semantic Dialog</DialogTitle>
              <DialogDescription>This dialog follows semantic HTML.</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole('button', { name: 'Open' }));

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();

      // Title should be accessible
      const title = screen.getByText('Semantic Dialog');
      expect(title).toBeInTheDocument();
    });
  });

  describe('Overlay Behavior', () => {
    it('renders overlay when dialog is open', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole('button', { name: 'Open' }));

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();

      // Overlay should exist in the document (has bg-black/80 class)
      const overlay = document.querySelector('.bg-black\\/80');
      expect(overlay).toBeInTheDocument();
    });
  });

  describe('Complete Dialog Example', () => {
    it('renders a complete dialog with all components', async () => {
      const handleAction = vi.fn();
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger>Delete Item</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
              <DialogDescription>
                This action cannot be undone. Are you sure you want to delete this item?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <button>Cancel</button>
              </DialogClose>
              <button onClick={handleAction}>Delete</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );

      // Open dialog
      await user.click(screen.getByRole('button', { name: 'Delete Item' }));

      // Verify all content is present
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();
      expect(
        screen.getByText('This action cannot be undone. Are you sure you want to delete this item?')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();

      // Test action button
      await user.click(screen.getByRole('button', { name: 'Delete' }));
      expect(handleAction).toHaveBeenCalledTimes(1);

      // Test cancel button closes dialog
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
