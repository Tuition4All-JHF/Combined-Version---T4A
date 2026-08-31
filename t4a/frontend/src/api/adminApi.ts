import apiClient from './client';

export const adminApi = {
  approveCourse: async (courseId: number, data: any) => {
    const res = await apiClient.post(`/admin/courses/${courseId}/approve/`, data);
    return res.data;
  },

  getDashboardStats: async () => {
    const res = await apiClient.get('/admin/dashboard-stats/');
    return res.data;
  },
  getPendingTutors: async () => {
    const res = await apiClient.get('/admin/tutors/pending/');
    return res.data;
  },
  verifyTutor: async (tutorId: number, status: 'APPROVED' | 'REJECTED') => {
    const res = await apiClient.post(`/admin/tutors/${tutorId}/verify/`, { status });
    return res.data;
  },
  getSubjects: async () => {
    const res = await apiClient.get('/admin/subjects/');
    return res.data;
  },
  addSubject: async (name: string) => {
    const res = await apiClient.post('/admin/subjects/', { name });
    return res.data;
  },
  getPayments: async () => {
    const res = await apiClient.get('/admin/payments/');
    return res.data;
  },
  deleteSubject: async (id: number) => {
    await apiClient.delete(`/admin/subjects/${id}/`);
  },
  getAccounts: async () => {
    const res = await apiClient.get('/admin/accounts/');
    return res.data;
  },
  toggleFreezeAccount: async (id: number) => {
    const res = await apiClient.post(`/admin/accounts/${id}/freeze/`);
    return res.data;
  },
  getProfileDetail: async (id: number) => {
    const res = await apiClient.get(`/admin/accounts/${id}/profile/`);
    return res.data;
  },
};
