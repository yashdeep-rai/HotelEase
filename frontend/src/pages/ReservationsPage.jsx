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
  Select,
  Card,
  Separator,
} from '@radix-ui/themes';

const ReservationsPage = () => {
  const [reservations, setReservations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentReservation, setCurrentReservation] = useState(null);
  const [formData, setFormData] = useState({
    customerId: '',
    roomId: '',
    checkinDate: '',
    checkoutDate: '',
    totalAmount: '',
    status: 'Confirmed',
  });

  useEffect(() => {
    fetchReservations();
    fetchCustomers();
    fetchRooms();
  }, []);

  const fetchReservations = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/reservations');
      setReservations(response.data);
    } catch (error) {
      console.error('Error fetching reservations:', error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/customers');
      setCustomers(response.data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchRooms = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/rooms');
      setRooms(response.data);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleOpenChange = (isOpen) => {
    if (!isOpen) {
      setIsEditing(false);
      setCurrentReservation(null);
      setFormData({
        customerId: '',
        roomId: '',
        checkinDate: '',
        checkoutDate: '',
        totalAmount: '',
        status: 'Confirmed',
      });
    }
    setOpen(isOpen);
  };

  const handleAddClick = () => {
    setIsEditing(false);
    setFormData({
      customerId: '',
      roomId: '',
      checkinDate: '',
      checkoutDate: '',
      totalAmount: '',
      status: 'Confirmed',
    });
    setOpen(true);
  };

  const handleEditClick = (reservation) => {
    setIsEditing(true);
    setCurrentReservation(reservation);
    setFormData({
      customerId: reservation.customerId,
      roomId: reservation.roomId,
      checkinDate: new Date(reservation.checkinDate).toISOString().split('T')[0],
      checkoutDate: new Date(reservation.checkoutDate).toISOString().split('T')[0],
      totalAmount: reservation.totalAmount,
      status: reservation.status,
    });
    setOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = isEditing
      ? `http://localhost:3001/api/reservations/${currentReservation.reservationId}`
      : 'http://localhost:3001/api/reservations';
    const method = isEditing ? 'put' : 'post';

    try {
      await axios[method](url, formData);
      fetchReservations();
      handleOpenChange(false);
    } catch (error) {
      console.error('Error saving reservation:', error);
    }
  };

  const handleDelete = async (reservationId) => {
    try {
      await axios.delete(`http://localhost:3001/api/reservations/${reservationId}`);
      fetchReservations();
    } catch (error) {
      console.error('Error deleting reservation:', error);
    }
  };

  const getCustomerName = (customerId) => {
    const customer = customers.find((c) => c.customerId === customerId);
    return customer ? `${customer.firstName} ${customer.lastName}` : 'N/A';
  };

  const getRoomNumber = (roomId) => {
    const room = rooms.find((r) => r.roomId === roomId);
    return room ? room.roomNumber : 'N/A';
  };

  return (
    <Box>
      <Flex justify="between" align="center" mb="5">
        <Heading>Reservations</Heading>
        <Button onClick={handleAddClick}>Add Reservation</Button>
      </Flex>

      <Separator my="4" size="4" />

      <Dialog.Root open={open} onOpenChange={handleOpenChange}>
        <Dialog.Content style={{ maxWidth: 450 }}>
          <Dialog.Title>{isEditing ? 'Edit Reservation' : 'Add Reservation'}</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            {isEditing ? 'Edit the details of the reservation.' : 'Add a new reservation.'}
          </Dialog.Description>

          <form onSubmit={handleSubmit}>
            <Flex direction="column" gap="3">
              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  Customer
                </Text>
                <Select.Root
                  name="customerId"
                  value={formData.customerId}
                  onValueChange={(value) => handleSelectChange('customerId', value)}
                >
                  <Select.Trigger placeholder="Select a customer" />
                  <Select.Content>
                    {customers.map((customer) => (
                      <Select.Item key={customer.customerId} value={customer.customerId}>
                        {customer.firstName} {customer.lastName}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  Room
                </Text>
                <Select.Root
                  name="roomId"
                  value={formData.roomId}
                  onValueChange={(value) => handleSelectChange('roomId', value)}
                >
                  <Select.Trigger placeholder="Select a room" />
                  <Select.Content>
                    {rooms.map((room) => (
                      <Select.Item key={room.roomId} value={room.roomId}>
                        {room.roomNumber} - {room.roomType}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  Check-in Date
                </Text>
                <TextField.Input
                  name="checkinDate"
                  type="date"
                  value={formData.checkinDate}
                  onChange={handleInputChange}
                  required
                />
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  Check-out Date
                </Text>
                <TextField.Input
                  name="checkoutDate"
                  type="date"
                  value={formData.checkoutDate}
                  onChange={handleInputChange}
                  required
                />
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  Total Amount
                </Text>
                <TextField.Input
                  name="totalAmount"
                  type="number"
                  value={formData.totalAmount}
                  onChange={handleInputChange}
                  placeholder="Enter total amount"
                  required
                />
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  Status
                </Text>
                <Select.Root
                  name="status"
                  value={formData.status}
                  onValueChange={(value) => handleSelectChange('status', value)}
                >
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Item value="Confirmed">Confirmed</Select.Item>
                    <Select.Item value="Checked-in">Checked-in</Select.Item>
                    <Select.Item value="Checked-out">Checked-out</Select.Item>
                    <Select.Item value="Cancelled">Cancelled</Select.Item>
                  </Select.Content>
                </Select.Root>
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
              <Table.ColumnHeaderCell>Customer</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Room</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Check-in</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Check-out</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Total Amount</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {reservations.map((reservation) => (
              <Table.Row key={reservation.reservationId}>
                <Table.RowHeaderCell>{getCustomerName(reservation.customerId)}</Table.RowHeaderCell>
                <Table.Cell>{getRoomNumber(reservation.roomId)}</Table.Cell>
                <Table.Cell>{new Date(reservation.checkinDate).toLocaleDateString()}</Table.Cell>
                <Table.Cell>{new Date(reservation.checkoutDate).toLocaleDateString()}</Table.Cell>
                <Table.Cell>${reservation.totalAmount}</Table.Cell>
                <Table.Cell>{reservation.status}</Table.Cell>
                <Table.Cell>
                  <Flex gap="3">
                    <Button size="1" onClick={() => handleEditClick(reservation)}>
                      Edit
                    </Button>
                    <Button
                      size="1"
                      color="red"
                      onClick={() => handleDelete(reservation.reservationId)}
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

export default ReservationsPage;
