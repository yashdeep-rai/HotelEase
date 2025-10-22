import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Heading,
  Button,
  Table,
  Flex,
  Dialog,
  TextField,
  Text,
  Card,
  Separator,
} from '@radix-ui/themes';

const CustomersPage = () => {
  const [customers, setCustomers] = useState([]);
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/customers');
      setCustomers(response.data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleOpenChange = (isOpen) => {
    if (!isOpen) {
      setIsEditing(false);
      setCurrentCustomer(null);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
      });
    }
    setOpen(isOpen);
  };

  const handleAddClick = () => {
    setIsEditing(false);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
    });
    setOpen(true);
  };

  const handleEditClick = (customer) => {
    setIsEditing(true);
    setCurrentCustomer(customer);
    setFormData({
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
    });
    setOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = isEditing
      ? `http://localhost:3001/api/customers/${currentCustomer.customerId}`
      : 'http://localhost:3001/api/customers';
    const method = isEditing ? 'put' : 'post';

    try {
      await axios[method](url, formData);
      fetchCustomers();
      handleOpenChange(false);
    } catch (error) {
      console.error('Error saving customer:', error);
    }
  };

  const handleDelete = async (customerId) => {
    try {
      await axios.delete(`http://localhost:3001/api/customers/${customerId}`);
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
    }
  };

  return (
    <Box>
      <Flex justify="between" align="center" mb="5">
        <Heading>Customers</Heading>
        <Button onClick={handleAddClick}>Add Customer</Button>
      </Flex>

      <Separator my="4" size="4" />

      <Dialog.Root open={open} onOpenChange={handleOpenChange}>
        <Dialog.Content style={{ maxWidth: 450 }}>
          <Dialog.Title>{isEditing ? 'Edit Customer' : 'Add Customer'}</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            {isEditing ? 'Edit the details of the customer.' : 'Add a new customer.'}
          </Dialog.Description>

          <form onSubmit={handleSubmit}>
            <Flex direction="column" gap="3">
              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  First Name
                </Text>
                <TextField.Input
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  placeholder="Enter first name"
                  required
                />
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  Last Name
                </Text>
                <TextField.Input
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  placeholder="Enter last name"
                  required
                />
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  Email
                </Text>
                <TextField.Input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter email"
                  required
                />
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  Phone
                </Text>
                <TextField.Input
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="Enter phone number"
                />
              </label>
            </Flex>

            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit">Save</Button>
            </Flex>
          </form>
        </Dialog.Content>
      </Dialog.Root>

      <Card>
        <Table.Root variant="surface">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Email</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Phone</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {customers.map((customer) => (
              <Table.Row key={customer.customerId}>
                <Table.RowHeaderCell>
                  {customer.firstName} {customer.lastName}
                </Table.RowHeaderCell>
                <Table.Cell>{customer.email}</Table.Cell>
                <Table.Cell>{customer.phone}</Table.Cell>
                <Table.Cell>
                  <Flex gap="3">
                    <Button size="1" onClick={() => handleEditClick(customer)}>
                      Edit
                    </Button>
                    <Button
                      size="1"
                      color="red"
                      onClick={() => handleDelete(customer.customerId)}
                    >
                      Delete
                    </Button>
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Card>
    </Box>
  );
};

export default CustomersPage;
