import type { Employee, OrgNode } from '../../src/lib/types.js';

export const validEmployee: Employee = {
	displayName: 'Jane Doe',
	firstName: 'Jane',
	lastName: 'Doe',
	email: 'jane@example.com',
	title: 'CEO',
	department: 'Executive',
	manager: 'No Manager',
	mobile: '+1-555-0000',
	streetAddress: '123 Main St',
	city: 'San Francisco',
	country: 'USA',
};

export const minimalOrgEmployees: Employee[] = [
	{
		displayName: 'Jane Doe',
		firstName: 'Jane',
		lastName: 'Doe',
		email: 'jane@example.com',
		title: 'CEO',
		department: 'Executive',
		manager: 'No Manager',
		mobile: '+1-555-0000',
		streetAddress: '123 Main St',
		city: 'San Francisco',
		country: 'USA',
	},
	{
		displayName: 'John Smith',
		firstName: 'John',
		lastName: 'Smith',
		email: 'john@example.com',
		title: 'Manager',
		department: 'Engineering',
		manager: 'Jane Doe',
		mobile: '+1-555-0001',
		streetAddress: '124 Main St',
		city: 'San Francisco',
		country: 'USA',
	},
];

export const multiLevelOrgEmployees: Employee[] = [
	{
		displayName: 'Alice Johnson',
		firstName: 'Alice',
		lastName: 'Johnson',
		email: 'alice@example.com',
		title: 'CEO',
		department: 'Executive',
		manager: 'No Manager',
		mobile: '+1-555-0000',
		streetAddress: '100 Main St',
		city: 'San Francisco',
		country: 'USA',
	},
	{
		displayName: 'Bob Williams',
		firstName: 'Bob',
		lastName: 'Williams',
		email: 'bob@example.com',
		title: 'VP Engineering',
		department: 'Engineering',
		manager: 'Alice Johnson',
		mobile: '+1-555-0001',
		streetAddress: '101 Main St',
		city: 'San Francisco',
		country: 'USA',
	},
	{
		displayName: 'Carol Davis',
		firstName: 'Carol',
		lastName: 'Davis',
		email: 'carol@example.com',
		title: 'VP Sales',
		department: 'Sales',
		manager: 'Alice Johnson',
		mobile: '+1-555-0002',
		streetAddress: '102 Main St',
		city: 'San Francisco',
		country: 'USA',
	},
	{
		displayName: 'David Brown',
		firstName: 'David',
		lastName: 'Brown',
		email: 'david@example.com',
		title: 'Senior Engineer',
		department: 'Engineering',
		manager: 'Bob Williams',
		mobile: '+1-555-0003',
		streetAddress: '103 Main St',
		city: 'San Francisco',
		country: 'USA',
	},
	{
		displayName: 'Eve Martinez',
		firstName: 'Eve',
		lastName: 'Martinez',
		email: 'eve@example.com',
		title: 'Engineer',
		department: 'Engineering',
		manager: 'Bob Williams',
		mobile: '+1-555-0004',
		streetAddress: '104 Main St',
		city: 'San Francisco',
		country: 'USA',
	},
];

export const minimalOrgTree: OrgNode = {
	employee: minimalOrgEmployees[0],
	directReports: [
		{
			employee: minimalOrgEmployees[1],
			directReports: [],
		},
	],
};

export const multiLevelOrgTree: OrgNode = {
	employee: multiLevelOrgEmployees[0],
	directReports: [
		{
			employee: multiLevelOrgEmployees[1],
			directReports: [
				{
					employee: multiLevelOrgEmployees[3],
					directReports: [],
				},
				{
					employee: multiLevelOrgEmployees[4],
					directReports: [],
				},
			],
		},
		{
			employee: multiLevelOrgEmployees[2],
			directReports: [],
		},
	],
};

export const singleEmployeeOrg: Employee[] = [
	{
		displayName: 'Solo CEO',
		firstName: 'Solo',
		lastName: 'CEO',
		email: 'solo@example.com',
		title: 'CEO',
		department: 'Executive',
		manager: 'No Manager',
		mobile: '+1-555-0000',
		streetAddress: '200 Main St',
		city: 'New York',
		country: 'USA',
	},
];
