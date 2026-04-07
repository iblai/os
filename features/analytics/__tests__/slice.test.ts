import { describe, it, expect } from 'vitest';
import {
  analyticsReducer,
  analyticsActions,
  selectSelectedMentor,
  type SelectedMentor,
  type AnalyticsState,
} from '../slice';

describe('analytics slice', () => {
  const initialState: AnalyticsState = {
    selectedMentor: null,
  };

  describe('initial state', () => {
    it('should have selectedMentor as null', () => {
      const state = analyticsReducer(undefined, { type: '@@INIT' });
      expect(state.selectedMentor).toBeNull();
    });
  });

  describe('setSelectedMentor', () => {
    it('should set selected mentor', () => {
      const mentor: SelectedMentor = {
        slug: 'math-tutor',
        name: 'Math Tutor',
        profileImage: 'https://example.com/avatar.jpg',
        unique_id: 'mentor-123',
      };

      const state = analyticsReducer(
        initialState,
        analyticsActions.setSelectedMentor(mentor),
      );
      expect(state.selectedMentor).toEqual(mentor);
    });

    it('should update selected mentor', () => {
      const mentor1: SelectedMentor = {
        slug: 'math-tutor',
        name: 'Math Tutor',
        profileImage: 'https://example.com/avatar1.jpg',
        unique_id: 'mentor-123',
      };

      const mentor2: SelectedMentor = {
        slug: 'science-tutor',
        name: 'Science Tutor',
        profileImage: 'https://example.com/avatar2.jpg',
        unique_id: 'mentor-456',
      };

      let state = analyticsReducer(
        initialState,
        analyticsActions.setSelectedMentor(mentor1),
      );
      state = analyticsReducer(
        state,
        analyticsActions.setSelectedMentor(mentor2),
      );
      expect(state.selectedMentor).toEqual(mentor2);
    });

    it('should set selected mentor to null', () => {
      const mentor: SelectedMentor = {
        slug: 'math-tutor',
        name: 'Math Tutor',
        profileImage: 'https://example.com/avatar.jpg',
        unique_id: 'mentor-123',
      };

      let state = analyticsReducer(
        initialState,
        analyticsActions.setSelectedMentor(mentor),
      );
      state = analyticsReducer(state, analyticsActions.setSelectedMentor(null));
      expect(state.selectedMentor).toBeNull();
    });
  });

  describe('selectSelectedMentor', () => {
    it('should select mentor from state', () => {
      const mentor: SelectedMentor = {
        slug: 'math-tutor',
        name: 'Math Tutor',
        profileImage: 'https://example.com/avatar.jpg',
        unique_id: 'mentor-123',
      };

      const state = { analytics: { selectedMentor: mentor } };
      expect(selectSelectedMentor(state)).toEqual(mentor);
    });

    it('should return null when no mentor selected', () => {
      const state = { analytics: { selectedMentor: null } };
      expect(selectSelectedMentor(state)).toBeNull();
    });
  });
});
