import { LocalStorageAdapter } from './storage/LocalStorageAdapter';

const defaultStudent = {
  university: '',
  degree: '',
  currentSemester: 1,
  targetCGPA: 8.5,
  semesters: [],
  backlogs: [],
};

export const StorageService = {
  getStudent() {
    return LocalStorageAdapter.load() || defaultStudent;
  },

  saveStudent(data) {
    LocalStorageAdapter.save(data);
  },

  clearStudent() {
    LocalStorageAdapter.clear();
  },
};