export function publicUser(user) {
  return {
    id: user.id,
    employeeId: user.employee_id,
    username: user.username,
    role: user.role,
    status: user.status,
    firstName: user.first_name,
    lastName: user.last_name,
    position: user.position
  };
}
