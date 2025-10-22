import React from 'react';
import { Box, Flex, Heading, Text, Button, Card, Grid, Separator } from '@radix-ui/themes';
import { RocketIcon, PersonIcon, CheckCircledIcon } from '@radix-ui/react-icons';

const LandingPage = () => {
  return (
    <Box>
      {/* Hero Section */}
      <Flex
        direction="column"
        align="center"
        justify="center"
        py="9"
        px="4"
        style={{
          background: 'linear-gradient(135deg, var(--accent-9), var(--accent-11))',
          color: 'white',
          borderRadius: 'var(--radius-4)',
        }}
      >
        <Heading as="h1" size="9" align="center" mb="3">
          Welcome to HotelEase
        </Heading>
        <Text size="5" align="center" mb="6">
          Your one-stop solution for seamless hotel management.
        </Text>
        <Button size="3" highContrast>
          Get Started
        </Button>
      </Flex>

      {/* Features Section */}
      <Box py="8" px="4">
        <Heading as="h2" size="7" align="center" mb="7">
          Key Features
        </Heading>
        <Grid columns={{ initial: '1', sm: '3' }} gap="6">
          <Card>
            <Flex direction="column" align="center" p="5">
              <RocketIcon width="48" height="48" color="var(--accent-9)" />
              <Heading as="h3" size="5" mt="4" mb="2">
                Room Management
              </Heading>
              <Text align="center">
                Easily manage room bookings, availability, and pricing.
              </Text>
            </Flex>
          </Card>
          <Card>
            <Flex direction="column" align="center" p="5">
              <PersonIcon width="48" height="48" color="var(--accent-9)" />
              <Heading as="h3" size="5" mt="4" mb="2">
                Customer Relationship
              </Heading>
              <Text align="center">
                Keep track of customer details and booking history.
              </Text>
            </Flex>
          </Card>
          <Card>
            <Flex direction="column" align="center" p="5">
              <CheckCircledIcon width="48" height="48" color="var(--accent-9)" />
              <Heading as="h3" size="5" mt="4" mb="2">
                Effortless Reservations
              </Heading>
              <Text align="center">
                A simple and intuitive reservation system for your guests.
              </Text>
            </Flex>
          </Card>
        </Grid>
      </Box>

      {/* CTA Section */}
      <Box
        py="8"
        px="4"
        my="6"
        style={{
          background: 'var(--gray-a2)',
          borderRadius: 'var(--radius-4)',
        }}
      >
        <Flex direction="column" align="center" justify="center">
          <Heading as="h2" size="6" align="center" mb="4">
            Ready to streamline your hotel operations?
          </Heading>
          <Button size="3" variant="solid">
            Sign Up Now
          </Button>
        </Flex>
      </Box>

      {/* Footer */}
      <Separator size="4" my="6" />
      <Box pb="5" px="4">
        <Text as="p" size="2" align="center" color="gray">
          &copy; 2025 HotelEase. All rights reserved.
        </Text>
      </Box>
    </Box>
  );
};

export default LandingPage;